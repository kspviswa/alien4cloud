package alien4cloud.variable;

import alien4cloud.rest.utils.JsonUtil;
import lombok.SneakyThrows;
import org.apache.commons.lang3.StringUtils;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.env.PropertySource;
import org.springframework.core.env.PropertySources;
import org.springframework.core.env.PropertySourcesPropertyResolver;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * PropertyResolver can resolve only String.
 * <p>
 * This class workaround this limitation by serializing {@link Map} and {@link Collection} objects into JSON during property resolution then
 * de-serialized before returning the value.
 */
class ObjectSourcesPropertyResolver extends PropertySourcesPropertyResolver {

    private static final String JSON_MAP_MARKER = "__JSONMAP__";
    private static final String JSON_COLLECTION_MARKER = "__JSONCOLLECTION__";
    private PropertySources propertySources;

    public ObjectSourcesPropertyResolver(PropertySources propertySources) {
        super(propertySources);
        this.propertySources = propertySources;

        getConversionService().addConverter(new Converter<Map, String>() {
            @Override
            @SneakyThrows
            public String convert(Map source) {
                return JSON_MAP_MARKER + JsonUtil.toString(source) + JSON_MAP_MARKER;
            }
        });

        getConversionService().addConverter(new Converter<Collection, String>() {
            @Override
            @SneakyThrows
            public String convert(Collection source) {
                return JSON_COLLECTION_MARKER + JsonUtil.toString(source) + JSON_COLLECTION_MARKER;
            }
        });
    }

    @SneakyThrows
    @SuppressWarnings("unchecked")
    private void resolvePlaceholdersInMap(Map<Object, Object> map) {
        for (Map.Entry<Object, Object> entry : map.entrySet()) {
            if (entry.getValue() == null) {
                continue;
            }

            if (entry.getValue() instanceof String) {
                String resolved = resolveNestedPlaceholders((String) entry.getValue());
                Object newValue = resolved;
                if (resolved.contains(JSON_MAP_MARKER)) {
                    String json = StringUtils.substringBetween(resolved, JSON_MAP_MARKER);
                    newValue = JsonUtil.toMap(json);
                }
                if (resolved.contains(JSON_COLLECTION_MARKER)) {
                    String json = StringUtils.substringBetween(resolved, JSON_COLLECTION_MARKER);
                    newValue = JsonUtil.readObject(json, List.class);
                }
                entry.setValue(newValue);
            } else if (entry.getValue() instanceof Map) {
                resolvePlaceholdersInMap((Map) entry.getValue());
            } else if (entry.getValue() instanceof Collection) {
                entry.setValue(resolvePlaceholdersInCollection((Collection) entry.getValue()));
            }
        }
    }

    @SneakyThrows
    @SuppressWarnings("unchecked")
    private Collection<Object> resolvePlaceholdersInCollection(Collection<Object> collection) {
        if (collection == null) {
            return null;
        }

        Collection<Object> updatedCollection = collection.getClass().newInstance();

        for (Object obj : collection) {
            if (obj == null) {
                continue;
            }

            if (obj instanceof String) {
                String resolved = resolveNestedPlaceholders((String) obj);
                Object newValue = resolved;
                if (resolved.contains(JSON_MAP_MARKER)) {
                    String json = StringUtils.substringBetween(resolved, JSON_MAP_MARKER);
                    newValue = JsonUtil.toMap(json);
                }
                updatedCollection.add(newValue);
            } else if (obj instanceof Map) {
                updatedCollection.add(obj);
                resolvePlaceholdersInMap((Map) obj);
            } else if (obj instanceof Collection) {
                updatedCollection.add(resolvePlaceholdersInCollection((Collection) obj));
            } else {
                updatedCollection.add(obj);
            }
        }

        return updatedCollection;
    }

    @Override
    @SuppressWarnings("unchecked")
    protected <T> T getProperty(String key, Class<T> targetValueType, boolean resolveNestedPlaceholders) {
        if (this.propertySources != null) {
            for (PropertySource<?> propertySource : this.propertySources) {
                if (logger.isTraceEnabled()) {
                    logger.trace(String.format("Searching for key '%s' in [%s]", key, propertySource.getName()));
                }
                Object value = propertySource.getProperty(key);
                if (value != null) {
                    if (resolveNestedPlaceholders) {
                        if (value instanceof String) {
                            value = resolveNestedPlaceholders((String) value);
                        } else if (value instanceof Map) {
                            resolvePlaceholdersInMap((Map) value);
                        } else if (value instanceof Collection) {
                            value = resolvePlaceholdersInCollection((Collection) value);
                        }
                    }
                    logKeyFound(key, propertySource, value);
                    return this.conversionService.convert(value, targetValueType);
                }
            }
        }
        if (logger.isDebugEnabled()) {
            logger.debug(String.format("Could not find key '%s' in any property source", key));
        }
        return null;
    }

}
