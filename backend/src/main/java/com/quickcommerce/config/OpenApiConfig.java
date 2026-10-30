package com.quickcommerce.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI quickCartOpenApi() {
        return new OpenAPI().info(new Info()
                .title("QuickCart API")
                .version("1.0.0")
                .description("Hyperlocal quick-commerce engine: dark-store catalog, atomic stock reservation, "
                        + "payments and live order tracking. Auth uses HttpOnly cookies set by /api/v1/auth/login."));
    }
}
