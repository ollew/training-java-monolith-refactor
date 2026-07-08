Users-service test fixtures

How to use
- These SQL files are fixtures for acceptance tests of the `users-service` compatibility layer.
- They assume the schema defined by the legacy app is present (see `schema.sql`). If running against a fresh database, run `schema.sql` first.
- Execute the chosen seed file before running the corresponding acceptance test. Examples (Derby/SQL):

PowerShell (Derby ij):
  C:\> java -jar path\to\derbyrun.jar ij
  ij> CONNECT 'jdbc:derby:./data/bigbadmonolith;create=true';
  ij> RUN 'tests/users-service/schema.sql';
  ij> RUN 'tests/users-service/seed_totals.sql';

Notes
- The seed files use subselects to link rows by business keys (email, name) so they are tolerant to identity values assigned by the DB.
- Dates use `CURRENT_DATE`/`CURRENT_TIMESTAMP` where appropriate so tests can run without date adjustments.
