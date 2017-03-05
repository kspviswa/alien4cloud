package alien4cloud.rest.service;

import javax.inject.Inject;
import javax.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import alien4cloud.audit.annotation.Audit;
import alien4cloud.model.service.ServiceResource;
import alien4cloud.rest.model.RestResponse;
import alien4cloud.rest.model.RestResponseBuilder;
import alien4cloud.rest.service.model.CreateManagedServiceResourceRequest;
import alien4cloud.service.ManagedServiceResourceService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import io.swagger.annotations.Authorization;

/**
 * Controller to manage services that are backed by an alien4cloud application environment.
 */
@RestController
@RequestMapping({ "/rest/applications/{applicationId:.+}/environments/{environmentId:.+}/services",
        "/rest/v1/applications/{applicationId:.+}/environments/{environmentId:.+}/services",
        "/rest/latest/applications/{applicationId:.+}/environments/{environmentId:.+}/services" })
@Api(value = "Managed Services", description = "Allow to create/read/update/delete and search services linked to an application environment.")
public class ManagedServiceResourceController {
    @Inject
    private ManagedServiceResourceService managedServiceResourceService;

    @RequestMapping(method = RequestMethod.POST, consumes = MediaType.APPLICATION_JSON_VALUE)
    @ApiOperation(value = "Create a service from an application environment.", authorizations = { @Authorization("DEPLOYMENT_MANAGER") })
    @ResponseStatus(value = HttpStatus.CREATED)
    @Audit
    public RestResponse<String> create(@PathVariable String environmentId,
            @ApiParam(value = "Create service", required = true) @Valid @RequestBody CreateManagedServiceResourceRequest createRequest) {
        String serviceId = managedServiceResourceService.create(createRequest.getServiceName(), environmentId);
        return RestResponseBuilder.<String> builder().data(serviceId).build();
    }

    @RequestMapping(method = RequestMethod.GET)
    @ApiOperation(value = "Get a service associated with an application environment.", authorizations = { @Authorization("DEPLOYMENT_MANAGER") })
    public RestResponse<ServiceResource> getServiceResource(@PathVariable String environmentId) {
        return RestResponseBuilder.<ServiceResource> builder().data(managedServiceResourceService.get(environmentId)).build();
    }
}