package com.quickcommerce.security;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** Google/GitHub registrations whose client id is still "disabled" are hidden and never wired into login. */
@Component
public class OAuthProviders {

    private final ObjectProvider<ClientRegistrationRepository> repository;

    public OAuthProviders(ObjectProvider<ClientRegistrationRepository> repository) {
        this.repository = repository;
    }

    public List<ClientRegistration> enabled() {
        List<ClientRegistration> regs = new ArrayList<>();
        ClientRegistrationRepository repo = repository.getIfAvailable();
        if (repo instanceof Iterable<?> iterable) {
            for (Object o : iterable) {
                ClientRegistration r = (ClientRegistration) o;
                if (!"disabled".equals(r.getClientId())) regs.add(r);
            }
        }
        return regs;
    }

    public List<String> enabledIds() {
        return enabled().stream().map(ClientRegistration::getRegistrationId).toList();
    }

    public ClientRegistrationRepository enabledRepository() {
        return new InMemoryClientRegistrationRepository(enabled());
    }
}
