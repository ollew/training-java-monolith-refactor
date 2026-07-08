package com.sourcegraph.demo.acceptance;

import io.restassured.RestAssured;
import io.restassured.response.Response;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;

public class UsersServiceAcceptanceTest {

    @BeforeAll
    public static void setup() {
        String base = System.getProperty("users.base", "http://localhost:9080");
        RestAssured.baseURI = base;
    }

    @Test
    public void createUser_thenReturnsCreatedUser() {
        String payload = "{\"email\":\"testuser+1@example.org\",\"name\":\"Test User 1\"}";

        Response r = given()
                .contentType("application/json")
                .body(payload)
                .when()
                .post("/api/users")
                .then()
                .statusCode(201)
                .extract().response();

        assertThat(r.jsonPath().getString("email"), is("testuser+1@example.org"));
        assertThat(r.jsonPath().getString("name"), is("Test User 1"));
    }

    @Test
    public void creatingDuplicate_returns409WithFriendlyMessage() {
        String payload = "{\"email\":\"dup@example.org\",\"name\":\"Dup User\"}";

        // First create (idempotent if already seeded)
        given().contentType("application/json").body(payload).when().post("/api/users");

        // Second create must yield 409
        Response r = given()
                .contentType("application/json")
                .body(payload)
                .when()
                .post("/api/users")
                .then()
                .statusCode(409)
                .extract().response();

        String msg = r.jsonPath().getString("message");
        assertThat(msg.toLowerCase(), containsString("email"));
    }

    @Test
    public void getUserById_andByEmail_work() {
        String payload = "{\"email\":\"testuser+2@example.org\",\"name\":\"Test User 2\"}";

        Response create = given().contentType("application/json").body(payload).when().post("/api/users").then().statusCode(201).extract().response();
        int id = create.jsonPath().getInt("id");

        // GET by id
        Response byId = given().when().get("/api/users/" + id).then().statusCode(200).extract().response();
        assertThat(byId.jsonPath().getString("email"), is("testuser+2@example.org"));

        // GET by email - expecting either single object or array; handle both
        Response byEmail = given().queryParam("email", "testuser+2@example.org").when().get("/api/users").then().statusCode(200).extract().response();
        // Try to read id from object or first element
        Integer foundId = null;
        try {
            foundId = byEmail.jsonPath().getInt("id");
        } catch (Exception ignored) {}
        if (foundId == null || foundId == 0) {
            foundId = byEmail.jsonPath().getInt("[0].id");
        }
        assertThat(foundId, is(id));
    }

    @Test
    public void totalsCalculation_matchesSeededData() {
        // seed_totals.sql contains user with email u1@example.org and two billable_hours: 2.5@100 and 1.25@150
        Integer id = getUserIdByEmail("u1@example.org");
        Response r = given().when().get("/api/users/" + id + "/totals").then().statusCode(200).extract().response();

        double totalHours = r.jsonPath().getDouble("totalHours");
        double totalRevenue = r.jsonPath().getDouble("totalRevenue");

        assertThat(totalHours, closeTo(3.75, 0.0001));
        assertThat(totalRevenue, closeTo(437.5, 0.001));
    }

    @Test
    public void deleteUser_withDependentBillableHours_returns409() {
        Integer id = getUserIdByEmail("u1@example.org");
        given().when().delete("/api/users/" + id).then().statusCode(409);
    }

    private Integer getUserIdByEmail(String email) {
        Response r = given().queryParam("email", email).when().get("/api/users").then().statusCode(200).extract().response();
        Integer id = null;
        try { id = r.jsonPath().getInt("id"); } catch (Exception ignored) {}
        if (id == null || id == 0) {
            id = r.jsonPath().getInt("[0].id");
        }
        return id;
    }
}
