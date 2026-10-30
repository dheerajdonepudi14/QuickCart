FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/quickcart-backend-1.0.0.jar app.jar
EXPOSE 8080
# Managed Postgres (e.g. Render) hands out host/port/name separately; build the JDBC URL when DB_URL isn't set.
ENTRYPOINT ["sh","-c","if [ -z \"$DB_URL\" ] && [ -n \"$DB_HOST\" ]; then export DB_URL=\"jdbc:postgresql://$DB_HOST:${DB_PORT:-5432}/$DB_NAME\"; fi; exec java -jar /app/app.jar"]
