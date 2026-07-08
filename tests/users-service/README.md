Users-service test fixtures

How to use
 `tests/users-service/README.md` — instructions to run the SQL fixtures and acceptance tests

Running the acceptance tests
 - Start the monolith or new `users-service` implementation so it is reachable.
 - Ensure the database is initialized with `schema.sql` and appropriate seeds (see files in this folder).
 - Run the PowerShell test harness:

```powershell
cd tests/users-service
powershell -ExecutionPolicy Bypass -File .\run-tests.ps1 -BaseUrl 'http://localhost:9080'
```

Notes:
 - The test harness uses `Invoke-RestMethod`/`Invoke-WebRequest` and expects endpoints at `/api/users` to exist.
 - The tests perform a POST create and then a duplicate create to validate 409 friendly handling.
  ij> RUN 'tests/users-service/seed_totals.sql';

Notes
- The seed files use subselects to link rows by business keys (email, name) so they are tolerant to identity values assigned by the DB.
- Dates use `CURRENT_DATE`/`CURRENT_TIMESTAMP` where appropriate so tests can run without date adjustments.
