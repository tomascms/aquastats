"""Unit tests for resilience patterns."""
import pytest
import asyncio
from datetime import datetime, timedelta
from app.core.resilience import CircuitBreaker, RetryPolicy, BulkheadPolicy


class TestCircuitBreaker:
    """Tests for circuit breaker pattern."""

    async def test_closed_state_allows_calls(self):
        """Test CLOSED state allows calls."""
        breaker = CircuitBreaker("test", fail_threshold=5)

        async def success_func():
            return "success"

        result = await breaker.call(success_func)
        assert result == "success"
        assert breaker.state == "CLOSED"
        assert breaker.failure_count == 0

    async def test_tracks_failures(self):
        """Test circuit breaker tracks failures."""
        breaker = CircuitBreaker("test", fail_threshold=3)

        async def failing_func():
            raise Exception("Error")

        for i in range(2):
            result = await breaker.call(failing_func)
            assert result is None
            assert breaker.failure_count == i + 1

        assert breaker.state == "CLOSED"

    async def test_opens_after_threshold(self):
        """Test circuit breaker opens after failure threshold."""
        breaker = CircuitBreaker("test", fail_threshold=3)

        async def failing_func():
            raise Exception("Error")

        # Make 3 failures
        for _ in range(3):
            await breaker.call(failing_func)

        assert breaker.state == "OPEN"
        assert breaker.last_failure_time is not None

    async def test_returns_none_when_open(self):
        """Test circuit breaker returns None when OPEN."""
        breaker = CircuitBreaker("test", fail_threshold=2, timeout_seconds=1)

        async def failing_func():
            raise Exception("Error")

        # Open the circuit
        for _ in range(2):
            await breaker.call(failing_func)

        assert breaker.state == "OPEN"

        # Further calls return None
        result = await breaker.call(failing_func)
        assert result is None

    async def test_half_open_after_timeout(self):
        """Test circuit breaker transitions to HALF_OPEN after timeout."""
        breaker = CircuitBreaker("test", fail_threshold=2, timeout_seconds=1)

        async def failing_func():
            raise Exception("Error")

        # Open the circuit
        for _ in range(2):
            await breaker.call(failing_func)

        assert breaker.state == "OPEN"

        # Wait for timeout
        await asyncio.sleep(1.1)

        async def success_func():
            return "success"

        # Next call should transition to HALF_OPEN
        result = await breaker.call(success_func)
        assert breaker.state == "HALF_OPEN"

    async def test_closes_after_success_threshold(self):
        """Test circuit breaker closes after success threshold in HALF_OPEN."""
        breaker = CircuitBreaker(
            "test", fail_threshold=2, success_threshold=2, timeout_seconds=0
        )

        async def failing_func():
            raise Exception("Error")

        # Open the circuit
        for _ in range(2):
            await breaker.call(failing_func)

        # Force HALF_OPEN
        breaker.state = "HALF_OPEN"
        breaker.last_failure_time = datetime.now() - timedelta(seconds=1)

        async def success_func():
            return "success"

        # 2 successes should close
        await breaker.call(success_func)
        assert breaker.state == "HALF_OPEN"

        await breaker.call(success_func)
        assert breaker.state == "CLOSED"
        assert breaker.failure_count == 0


class TestRetryPolicy:
    """Tests for retry policy."""

    async def test_first_attempt_success(self):
        """Test succeeds on first attempt."""
        policy = RetryPolicy(max_attempts=3)
        attempts = 0

        async def success_func():
            nonlocal attempts
            attempts += 1
            return "success"

        result = await policy.execute(success_func)
        assert result == "success"
        assert attempts == 1

    async def test_retries_on_failure(self):
        """Test retries on transient failure."""
        policy = RetryPolicy(max_attempts=3, initial_delay=0.01)
        attempts = 0

        async def fail_twice():
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise Exception("Transient error")
            return "success"

        result = await policy.execute(fail_twice)
        assert result == "success"
        assert attempts == 3

    async def test_exponential_backoff(self):
        """Test exponential backoff calculation."""
        policy = RetryPolicy(
            max_attempts=3,
            initial_delay=0.1,
            exponential_base=2.0,
            jitter=False,
        )

        delays = []
        for attempt in range(2):
            delay = policy._calculate_delay(attempt)
            delays.append(delay)

        # Delay should double
        assert delays[1] > delays[0]
        assert delays[1] == pytest.approx(delays[0] * 2, rel=0.01)

    async def test_max_delay_cap(self):
        """Test maximum delay cap."""
        policy = RetryPolicy(max_attempts=10, initial_delay=1, max_delay=5)

        delay = policy._calculate_delay(10)  # Would be huge without cap
        assert delay <= 5

    async def test_exhausts_retries(self):
        """Test raises after exhausting retries."""
        policy = RetryPolicy(max_attempts=2, initial_delay=0.01)

        async def always_fails():
            raise ValueError("Persistent error")

        with pytest.raises(ValueError, match="Persistent error"):
            await policy.execute(always_fails)

    async def test_jitter_adds_randomness(self):
        """Test jitter adds randomness to delays."""
        policy = RetryPolicy(
            max_attempts=3,
            initial_delay=1.0,
            exponential_base=2.0,
            jitter=True,
        )

        delays = []
        for _ in range(5):
            delay = policy._calculate_delay(0)
            delays.append(delay)

        # Delays should vary due to jitter
        assert len(set(delays)) > 1  # Not all same


class TestBulkheadPolicy:
    """Tests for bulkhead isolation."""

    async def test_concurrent_limit(self):
        """Test bulkhead limits concurrent executions."""
        bulkhead = BulkheadPolicy(max_concurrent=2)
        concurrent_count = 0
        max_concurrent = 0

        async def slow_func():
            nonlocal concurrent_count, max_concurrent
            concurrent_count += 1
            max_concurrent = max(max_concurrent, concurrent_count)
            await asyncio.sleep(0.05)
            concurrent_count -= 1
            return "done"

        # Run 5 tasks concurrently
        tasks = [bulkhead.execute(slow_func) for _ in range(5)]
        results = await asyncio.gather(*tasks)

        assert len(results) == 5
        assert max_concurrent <= 2  # Never exceeded limit

    async def test_sequential_execution(self):
        """Test sequential execution with limit 1."""
        bulkhead = BulkheadPolicy(max_concurrent=1)
        execution_times = []

        async def timed_func():
            execution_times.append(asyncio.get_event_loop().time())
            await asyncio.sleep(0.01)
            return "done"

        tasks = [bulkhead.execute(timed_func) for _ in range(3)]
        await asyncio.gather(*tasks)

        # Check sequential execution (each starts after previous ends)
        for i in range(1, len(execution_times)):
            assert execution_times[i] >= execution_times[i - 1]

    async def test_bulkhead_exception_does_not_block(self):
        """Test exception doesn't block other tasks."""
        bulkhead = BulkheadPolicy(max_concurrent=2)
        completed = []

        async def failing_func(fail=False):
            if fail:
                raise Exception("Error")
            completed.append(True)
            return "success"

        tasks = [
            bulkhead.execute(failing_func, fail=False),
            bulkhead.execute(failing_func, fail=True),
            bulkhead.execute(failing_func, fail=False),
        ]

        results = []
        for task in tasks:
            try:
                result = await task
                results.append(result)
            except:
                results.append("failed")

        # Two should succeed
        assert results.count("success") == 2
        assert results.count("failed") == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
