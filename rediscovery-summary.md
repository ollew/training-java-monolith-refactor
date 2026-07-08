aBig Bad Monolith — Printable Rediscovery Summary

Purpose: concise one-page summary of business rules, data model, integrations, and open questions (Liberty deployment authoritative).

1) Key Business Rules
- Users: `email` and `name` required; `email` UNIQUE (DB). See schema & DAO.
- Customers: `name` and `email` required; DAO prevents empty values.
- Billing Categories: `name` and `hourly_rate` required; `hourly_rate` is DECIMAL(10,2).
- Billable Hours: must reference existing Customer, User, Category; `hours` > 0; `date_logged` required and not future; weekend logging is allowed but flagged.
- Revenue: line amount = `hours * hourly_rate` (service uses BigDecimal; JSP/SQL also calculates line totals).

2) Data Model (entities & important DB constraints)
- User(id, email[NOT NULL UNIQUE], name)
- Customer(id, name[NOT NULL], email[NOT NULL], address, created_at[NOT NULL])
- BillingCategory(id, name, description, hourly_rate[DECIMAL(10,2) NOT NULL])
- BillableHour(id, customer_id -> customers.id, user_id -> users.id, category_id -> billing_categories.id, hours[DECIMAL(8,2) NOT NULL], date_logged[DATE NOT NULL], created_at[TIMESTAMP NOT NULL])

3) Integrations & Config
- Liberty DataSource (production): JNDI `jdbc/DefaultDataSource` — configured in `src/main/liberty/config/server.xml`.
- Embedded Derby fallback: `jdbc:derby:./data/bigbadmonolith;create=true` — used in dev and some JSPs.
- Derby jars expected under `${server.config.dir}/derby` per `server.xml`; `derby.database.path` is set in `bootstrap.properties`.
- Context root `/big-bad-monolith`; default ports `9080`/`9443`; dev basic user `user1`/`password` in `server.xml`.

4) Where to Verify (quick pointers)
- Schema DDL (embedded & Liberty): `src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java` and `.../LibertyConnectionManager.java`.
- Business validation logic: `src/main/java/com/sourcegraph/demo/bigbadmonolith/service/BillingService.java` (method `validateBillableHour`).
- Sample data insertion: `src/main/java/com/sourcegraph/demo/bigbadmonolith/service/DataInitializationService.java`.
- JSPs with direct DB access and reporting SQL: `src/main/webapp/reports.jsp`, `hours.jsp`, `customers.jsp`.

5) Open Questions (need business answers)
- Deletion policy for Customers/Users/Categories with existing hours: prevent/cascade/soft-delete?
- Duplicate `users.email` UX: friendly message or current exception behavior?
- Timezone: use UTC or server-local for timestamps and reports?
- Transactions: require multi-DAO ACID transactions or per-DAO operations acceptable?
- Reporting authority: `BillingService` BigDecimal calculations or JSP/SQL outputs?
- Runtime mapping of `${server.output.dir}` / `${server.config.dir}` in Liberty deployment (to locate DB files).

End of summary. For a PDF export, I can generate one locally and add it to the repo if you want.
