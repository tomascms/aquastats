"""Resilience patterns: Circuit breaker, retry, bulkhead."""
import asyncio
import random
from typing import Optional, Callable, TypeVar, Coroutine, Any
from datetime import datetime, timedelta
import structlog

logger = structlog.get_logger(__name__)

T = TypeVar('T')


class CircuitBreaker:
    """
    Circuit breaker pattern for external service calls.

    States: CLOSED → OPEN → HALF_OPEN → CLOSED
    """

    def __init__(
        self,
        name: str,
        fail_threshold: int = 5,
        success_threshold: int = 2,
        timeout_seconds: int = 60,
    ):
        self.name = name
        self.fail_threshold = fail_threshold
        self.success_threshold = success_threshold
        self.timeout_seconds = timeout_seconds

        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN

    async def call(
        self,
        func: Callable[..., Coroutine[Any, Any, T]],
        *args,
        **kwargs
    ) -> Optional[T]:
        """
        Execute function through circuit breaker.

        Args:
            func: Async function to call
            *args, **kwargs: Arguments for func

        Returns:
            Result of func, or None if circuit open
        """

        # Check if circuit should open
        if self.state == 'OPEN':
            if self._should_attempt_reset():
                self.state = 'HALF_OPEN'
                logger.info(
                    'circuit_breaker_half_open',
                    name=self.name,
                    state='HALF_OPEN'
                )
            else:
                logger.warning(
                    'circuit_breaker_open',
                    name=self.name,
                    failing_since=self.last_failure_time
                )
                return None

        try:
            result = await func(*args, **kwargs)

            # Call succeeded
            if self.state == 'HALF_OPEN':
                self.success_count += 1
                if self.success_count >= self.success_threshold:
                    self._reset()
                    logger.info(
                        'circuit_breaker_closed',
                        name=self.name,
                        state='CLOSED'
                    )
            else:
                self.failure_count = 0

            return result

        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = datetime.now()

            logger.error(
                'circuit_breaker_failure',
                name=self.name,
                error=str(e),
                failure_count=self.failure_count
            )

            if self.failure_count >= self.fail_threshold:
                self.state = 'OPEN'
                logger.critical(
                    'circuit_breaker_opened',
                    name=self.name,
                    reason='threshold exceeded'
                )

            return None

    def _should_attempt_reset(self) -> bool:
        """Check if timeout has elapsed."""
        if not self.last_failure_time:
            return False

        elapsed = (datetime.now() - self.last_failure_time).total_seconds()
        return elapsed >= self.timeout_seconds

    def _reset(self) -> None:
        """Reset to CLOSED state."""
        self.state = 'CLOSED'
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None


class RetryPolicy:
    """Async retry with exponential backoff."""

    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
    ):
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter

    async def execute(
        self,
        func: Callable[..., Coroutine[Any, Any, T]],
        *args,
        **kwargs
    ) -> T:
        """
        Execute function with retries on failure.

        Args:
            func: Async function to retry
            *args, **kwargs: Arguments for func

        Returns:
            Result of func

        Raises:
            Last exception if all attempts fail
        """
        last_exception = None

        for attempt in range(self.max_attempts):
            try:
                result = await func(*args, **kwargs)

                if attempt > 0:
                    logger.info(
                        'retry_success',
                        attempt=attempt + 1,
                        func=func.__name__
                    )

                return result

            except Exception as e:
                last_exception = e

                if attempt < self.max_attempts - 1:
                    delay = self._calculate_delay(attempt)
                    logger.warning(
                        'retry_delay',
                        attempt=attempt + 1,
                        delay_seconds=delay,
                        error=str(e)
                    )
                    await asyncio.sleep(delay)

        logger.error(
            'retry_exhausted',
            attempts=self.max_attempts,
            func=func.__name__,
            error=str(last_exception)
        )

        raise last_exception

    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff."""
        delay = self.initial_delay * (self.exponential_base ** attempt)
        delay = min(delay, self.max_delay)

        if self.jitter:
            # Add random jitter to prevent thundering herd
            delay += random.uniform(0, delay * 0.1)

        return delay


class BulkheadPolicy:
    """Isolate resource usage with semaphores."""

    def __init__(self, max_concurrent: int):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.max_concurrent = max_concurrent

    async def execute(
        self,
        func: Callable[..., Coroutine[Any, Any, T]],
        *args,
        **kwargs
    ) -> T:
        """
        Execute function within bulkhead limit.

        Args:
            func: Async function to execute
            *args, **kwargs: Arguments for func

        Returns:
            Result of func

        Raises:
            Exception if bulkhead rejected
        """
        async with self.semaphore:
            return await func(*args, **kwargs)


# Global circuit breakers for external services
stripe_breaker = CircuitBreaker(
    name='stripe',
    fail_threshold=5,
    success_threshold=2,
    timeout_seconds=60
)

resend_breaker = CircuitBreaker(
    name='resend',
    fail_threshold=5,
    success_threshold=2,
    timeout_seconds=60
)

s3_breaker = CircuitBreaker(
    name='s3',
    fail_threshold=5,
    success_threshold=2,
    timeout_seconds=60
)

# Retry policies
default_retry = RetryPolicy(
    max_attempts=3,
    initial_delay=1.0,
    max_delay=30.0
)

email_retry = RetryPolicy(
    max_attempts=5,
    initial_delay=2.0,
    max_delay=60.0
)

# Bulkheads for resource isolation
stripe_bulkhead = BulkheadPolicy(max_concurrent=5)
resend_bulkhead = BulkheadPolicy(max_concurrent=3)
s3_bulkhead = BulkheadPolicy(max_concurrent=10)
db_bulkhead = BulkheadPolicy(max_concurrent=20)


async def with_circuit_breaker(
    breaker: CircuitBreaker,
    func: Callable[..., Coroutine[Any, Any, T]],
    *args,
    **kwargs
) -> Optional[T]:
    """Convenience wrapper for circuit breaker."""
    return await breaker.call(func, *args, **kwargs)


async def with_retry(
    policy: RetryPolicy,
    func: Callable[..., Coroutine[Any, Any, T]],
    *args,
    **kwargs
) -> T:
    """Convenience wrapper for retry."""
    return await policy.execute(func, *args, **kwargs)


async def with_bulkhead(
    bulkhead: BulkheadPolicy,
    func: Callable[..., Coroutine[Any, Any, T]],
    *args,
    **kwargs
) -> T:
    """Convenience wrapper for bulkhead."""
    return await bulkhead.execute(func, *args, **kwargs)


# Example usage:
example_usage = """
# In routes/data_routes.py

from ..core.resilience import stripe_breaker, email_retry, stripe_bulkhead, resend_bulkhead

async def charge_user(user_id: UUID, amount: int):
    '''Charge user with resilience patterns.'''

    async def _charge():
        # Bulkhead: limit concurrent Stripe calls
        async with stripe_bulkhead.semaphore:
            # Circuit breaker: protect against Stripe outage
            result = await stripe_breaker.call(
                stripe.Charge.create,
                amount=amount
            )
            return result

    # Retry: handle transient failures
    try:
        return await email_retry.execute(_charge)
    except Exception as e:
        logger.error('charge_failed', user_id=str(user_id), error=str(e))
        return None


async def send_email(email: str, subject: str, body: str):
    '''Send email with resilience patterns.'''

    # Bulkhead + Circuit Breaker + Retry
    try:
        async with resend_bulkhead.semaphore:
            result = await resend_breaker.call(
                email_retry.execute,
                resend.send,
                email,
                subject,
                body
            )
            return result
    except Exception as e:
        logger.error('email_failed', email=email, error=str(e))
        return None
"""
