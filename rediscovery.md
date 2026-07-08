**Rediscovery: Big Bad Monolith**

**Overview**
- **Scope:** business rules, data-model summary, integration inventory, and open questions extracted from the codebase (Liberty deployment authoritative).

**Business Rules**
- **User identity:** email and name required; `email` is NOT NULL and UNIQUE. See schema and DAO: [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java#L32-L40), [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/LibertyConnectionManager.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/LibertyConnectionManager.java#L53-L60), [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/UserDAO.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/UserDAO.java#L8-L16).

- **Customer validation:** name and email must be present (DAO throws IllegalArgumentException); DB requires `name` and `created_at` NOT NULL. See [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/CustomerDAO.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/CustomerDAO.java#L14-L21), [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java#L42-L51).

- **Billing category:** category object required to save; `hourly_rate` stored as `DECIMAL(10,2)` and treated as required. See [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/BillingCategoryDAO.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/BillingCategoryDAO.java#L10-L18), [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java#L54-L60).

- **Billable hours invariants:** each `billable_hours` row must reference `customer_id`, `user_id`, `category_id` (FKs); `hours DECIMAL(8,2) NOT NULL`, `date_logged DATE NOT NULL`. See schema: [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java#L65-L80) and Liberty variant: [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/LibertyConnectionManager.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/LibertyConnectionManager.java#L86-L95).

- **Runtime validation for logged hours:** referenced Customer and Category must exist; `hours` > 0; `dateLogged` required and not future; weekend flagged as warning (not blocked). See [src/main/java/com/sourcegraph/demo/bigbadmonolith/service/BillingService.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/service/BillingService.java#L89-L119).

- **Revenue calc:** line amount = `hours * hourly_rate`. Implemented in service with `BigDecimal` and in JSP/SQL via `bh.hours * bc.hourly_rate`. See service: [src/main/java/com/sourcegraph/demo/bigbadmonolith/service/BillingService.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/service/BillingService.java#L1-L80) and JSP: [src/main/webapp/reports.jsp](src/main/webapp/reports.jsp#L150-L153).

- **Timestamps:** entities set `createdAt = DateTime.now()` when constructed; DAOs use entity value or fallback to `DateTime.now()` when inserting. See entity/DAO examples: [src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/BillableHour.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/BillableHour.java#L27-L27), [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/BillableHourDAO.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/BillableHourDAO.java#L25-L25).

**Data Model Summary**
- **User** — fields: `id`, `email`, `name`. Entity: [src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/User.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/User.java#L1-L40). DB constraints: `email NOT NULL UNIQUE` ([ConnectionManager](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java#L32-L40)).

- **Customer** — fields: `id`, `name`, `email`, `address`, `createdAt`. Entity: [src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/Customer.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/Customer.java#L1-L40). DB: `name`, `email`, `created_at` not null ([ConnectionManager](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java#L43-L51)).

- **BillingCategory** — fields: `id`, `name`, `description`, `hourlyRate` (BigDecimal). Entity: [src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/BillingCategory.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/BillingCategory.java#L1-L40). DB: `hourly_rate DECIMAL(10,2)` ([ConnectionManager](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java#L54-L60)).

- **BillableHour** — fields: `id`, `customerId`, `userId`, `categoryId`, `hours`, `note`, `dateLogged`, `createdAt`. Entity: [src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/BillableHour.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/entity/BillableHour.java#L1-L60). DB: `hours DECIMAL(8,2)`, `date_logged DATE`, FKs to `customers(id)`, `users(id)`, `billing_categories(id)` — [ConnectionManager](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java#L65-L80).

**Integration Inventory**
- **Liberty DataSource (production):** JNDI `jdbc/DefaultDataSource`. Config: [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/LibertyConnectionManager.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/LibertyConnectionManager.java#L11-L11) and [src/main/liberty/config/server.xml](src/main/liberty/config/server.xml#L50-L67).

- **Embedded Derby (fallback / JSP direct):** JDBC URL `jdbc:derby:./data/bigbadmonolith;create=true`. See `ConnectionManager.DB_URL` and JSP: [src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java](src/main/java/com/sourcegraph/demo/bigbadmonolith/dao/ConnectionManager.java#L9-L9), [src/main/webapp/reports.jsp](src/main/webapp/reports.jsp#L17-L24).

- **Filesystem / jars:** Derby jars expected at `${server.config.dir}/derby` per `server.xml` ([src/main/liberty/config/server.xml](src/main/liberty/config/server.xml#L70-L72)). `derby.database.path` set in bootstrap props ([src/main/liberty/config/bootstrap.properties](src/main/liberty/config/bootstrap.properties#L7-L9)).

- **HTTP / context:** Liberty context root `/big-bad-monolith` and ports `9080`/`9443` configured in [src/main/liberty/config/server.xml](src/main/liberty/config/server.xml#L47-L51) and [src/main/liberty/config/bootstrap.properties](src/main/liberty/config/bootstrap.properties#L1-L8).

- **Hard-coded dev credential:** basic user `user1` / `password` in [src/main/liberty/config/server.xml](src/main/liberty/config/server.xml#L26-L30).

**Open Questions (deferred)**
1. Delete semantics for `Customer`/`User`/`BillingCategory` with existing `billable_hours`: prevent / cascade / soft-delete? (Defer)
2. Duplicate `users.email` UX: friendly message or keep runtime exception behavior? (Defer)
3. Authoritative timezone for timestamps/reports: `UTC` or `server-local`? (Defer)
4. Transactional requirements for multi-DAO operations: require ACID spans or per-DAO acceptable? (Defer)
5. Authoritative source for financial reporting: `BillingService` BigDecimal or JSP/SQL double outputs? (Defer)
6. Exact runtime mapping of `${server.output.dir}` / `${server.config.dir}` in your Liberty deployment (needed to resolve DB file path). (Defer)

**Next steps**
- I created this document as `rediscovery.md`. If you want a separate printable one-page rule sheet or CSV mapping, tell me which format and I will add it.
