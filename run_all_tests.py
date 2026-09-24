#!/usr/bin/env python3
"""
Master test runner - validates all tests before deployment.

Run with: python run_all_tests.py
"""

import subprocess
import sys
import json
from datetime import datetime
from pathlib import Path


class TestRunner:
    """Runs all test suites and validates results."""

    def __init__(self):
        self.results = {}
        self.failed = False
        self.start_time = datetime.now()

    def run_command(self, cmd: list, name: str) -> bool:
        """Run command and track result."""
        print(f"\n{'='*60}")
        print(f"🧪 Running: {name}")
        print(f"{'='*60}")

        try:
            result = subprocess.run(
                cmd,
                cwd="api",
                capture_output=False,
                text=True,
            )

            success = result.returncode == 0
            self.results[name] = {
                'success': success,
                'timestamp': datetime.now().isoformat(),
            }

            if success:
                print(f"✅ {name} PASSED")
            else:
                print(f"❌ {name} FAILED")
                self.failed = True

            return success

        except Exception as e:
            print(f"❌ {name} ERROR: {e}")
            self.results[name] = {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
            }
            self.failed = True
            return False

    def run_unit_tests(self) -> bool:
        """Run unit tests with coverage."""
        return self.run_command(
            [
                'pytest',
                'tests/',
                '-v',
                '--cov=src/app',
                '--cov-report=term-missing:skip-covered',
                '--cov-report=html:htmlcov',
                '--cov-fail-under=85',
                '-m', 'not slow',
            ],
            'Unit Tests (>85% coverage)'
        )

    def run_validators_tests(self) -> bool:
        """Run validator tests."""
        return self.run_command(
            [
                'pytest',
                'tests/test_validators.py',
                '-v',
            ],
            'Validator Tests'
        )

    def run_billing_tests(self) -> bool:
        """Run billing tests."""
        return self.run_command(
            [
                'pytest',
                'tests/test_billing.py',
                '-v',
            ],
            'Billing Tests'
        )

    def run_resilience_tests(self) -> bool:
        """Run resilience pattern tests."""
        return self.run_command(
            [
                'pytest',
                'tests/test_resilience.py',
                '-v',
            ],
            'Resilience Pattern Tests'
        )

    def run_security_tests(self) -> bool:
        """Run security tests."""
        return self.run_command(
            [
                'pytest',
                'tests/test_security_comprehensive.py',
                '-v',
            ],
            'Security Tests (OWASP Top 10)'
        )

    def run_two_tier_tests(self) -> bool:
        """Run two-tier system tests."""
        return self.run_command(
            [
                'pytest',
                'tests/test_two_tier_system.py',
                '-v',
            ],
            'Two-Tier System & i18n Tests'
        )

    def run_bandit_security_scan(self) -> bool:
        """Run Bandit security scan."""
        return self.run_command(
            [
                'bandit',
                '-r',
                'src/',
                '-f', 'json',
                '-o', 'bandit-report.json',
            ],
            'Bandit Security Scan'
        )

    def run_safety_check(self) -> bool:
        """Check dependencies for vulnerabilities."""
        return self.run_command(
            [
                'safety',
                'check',
                '--json',
            ],
            'Dependency Vulnerability Check'
        )

    def run_linting(self) -> bool:
        """Run code linting."""
        # Try black first (non-fatal)
        subprocess.run(['black', '--check', 'src/', 'tests/'], cwd='api', capture_output=True)

        # Run flake8
        return self.run_command(
            [
                'flake8',
                'src/',
                'tests/',
                '--max-line-length=120',
                '--extend-ignore=E203,W503',
            ],
            'Code Linting (flake8)'
        )

    def generate_report(self):
        """Generate test report."""
        print(f"\n{'='*60}")
        print(f"📊 TEST REPORT")
        print(f"{'='*60}")

        passed = sum(1 for r in self.results.values() if r['success'])
        failed = sum(1 for r in self.results.values() if not r['success'])
        duration = (datetime.now() - self.start_time).total_seconds()

        print(f"\n✅ Passed: {passed}/{len(self.results)}")
        print(f"❌ Failed: {failed}/{len(self.results)}")
        print(f"⏱️  Duration: {duration:.1f}s")

        print(f"\n{'='*60}")
        print("Test Results:")
        print(f"{'='*60}")

        for name, result in self.results.items():
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"{status} - {name}")

        # Save report
        report_path = Path('api/test_report.json')
        with open(report_path, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'passed': passed,
                'failed': failed,
                'total': len(self.results),
                'duration_seconds': duration,
                'results': self.results,
            }, f, indent=2)

        print(f"\n📝 Report saved to: {report_path}")

    def run_all(self) -> int:
        """Run all tests and return exit code."""
        print(f"\n{'='*60}")
        print(f"🚀 AQUASTATS - COMPLETE TEST SUITE")
        print(f"Start: {self.start_time.isoformat()}")
        print(f"{'='*60}")

        # Run all tests
        self.run_unit_tests()
        self.run_validators_tests()
        self.run_billing_tests()
        self.run_resilience_tests()
        self.run_security_tests()
        self.run_two_tier_tests()
        self.run_bandit_security_scan()
        self.run_safety_check()
        self.run_linting()

        # Generate report
        self.generate_report()

        # Final status
        print(f"\n{'='*60}")
        if self.failed:
            print("❌ TESTS FAILED - DO NOT DEPLOY")
            print(f"{'='*60}")
            return 1
        else:
            print("✅ ALL TESTS PASSED - READY FOR DEPLOYMENT")
            print(f"{'='*60}")
            return 0


if __name__ == '__main__':
    runner = TestRunner()
    exit_code = runner.run_all()
    sys.exit(exit_code)
