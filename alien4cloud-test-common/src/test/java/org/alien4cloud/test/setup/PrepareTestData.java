package org.alien4cloud.test.setup;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.UnknownHostException;
import java.net.URI;
import java.util.Arrays;
import java.util.List;


import alien4cloud.git.RepositoryManager;
import alien4cloud.utils.FileUtil;
import lombok.extern.slf4j.Slf4j;

/**
 * Simple class that package the test archives as zip.
 */
@Slf4j
public class PrepareTestData {

    private final static RepositoryManager repositoryManager = new RepositoryManager();

    public static void main(String[] args) {
        System.setProperty("basedir", args[0]);
        try {
            FileUtil.delete(TestDataRegistry.IT_ARTIFACTS_DIR);
        } catch (IOException e) {
            log.error("Failed to delete zipped archives repository.", e);
        }

        try {
            FileUtil.delete(TestDataRegistry.GIT_ARTIFACTS_DIR);
        } catch (IOException e) {
            log.error("Failed to delete zipped archives repository.", e);
        }
/************************
ProxySelector.setDefault(new ProxySelector() {
    final ProxySelector delegate = ProxySelector.getDefault();

    @Override
    public List<Proxy> select(URI uri) {
		try {
            return Arrays.asList(new Proxy(Proxy.Type.HTTP, new InetSocketAddress
                    (InetAddress.getByName("193.56.47.20"), 8080)));
		} catch (UnknownHostException e) {
	        return delegate == null ? Arrays.asList(Proxy.NO_PROXY)
                : delegate.select(uri);
		}
    }

    @Override
    public void connectFailed(URI uri, SocketAddress sa, IOException ioe) {
        if (uri == null || sa == null || ioe == null) {
            throw new IllegalArgumentException(
                    "Arguments can't be null.");
        }
    }
});
****************************/


        repositoryManager.cloneOrCheckout(TestDataRegistry.GIT_ARTIFACTS_DIR, "https://github.com/alien4cloud/tosca-normative-types.git", "1.2.0",
                "tosca-normative-types-1.0.0-ALIEN12");

        repositoryManager.cloneOrCheckout(TestDataRegistry.GIT_ARTIFACTS_DIR, "https://github.com/alien4cloud/tosca-normative-types.git", "master",
                "tosca-normative-types-1.0.0-ALIEN14");

        repositoryManager.cloneOrCheckout(TestDataRegistry.GIT_ARTIFACTS_DIR, "https://github.com/alien4cloud/tosca-normative-types.git", "1.0.0.wd06.alien",
                "tosca-normative-types-wd06");

        repositoryManager.cloneOrCheckout(TestDataRegistry.GIT_ARTIFACTS_DIR, "https://github.com/alien4cloud/tosca-normative-types.git", "tests/2.0.0",
                "tosca-normative-types-1.0.0-SNAPSHOT");

        // TODO: Tests stills runs on wd03 data based on 1.1.0-SM4 tag
        repositoryManager.cloneOrCheckout(TestDataRegistry.GIT_ARTIFACTS_DIR, "https://github.com/alien4cloud/tosca-normative-types.git", "1.1.0-SM4",
                "tosca-normative-types");

        repositoryManager.cloneOrCheckout(TestDataRegistry.GIT_ARTIFACTS_DIR, "https://github.com/alien4cloud/alien4cloud-extended-types.git", "1.3.0",
                "alien4cloud-extended-types-V2");
        repositoryManager.cloneOrCheckout(TestDataRegistry.GIT_ARTIFACTS_DIR, "https://github.com/alien4cloud/alien4cloud-extended-types.git", "tests/2.0.0",
                "alien4cloud-extended-types-2.0.0-SNAPSHOT");
        repositoryManager.cloneOrCheckout(TestDataRegistry.GIT_ARTIFACTS_DIR, "https://github.com/alien4cloud/samples.git", "1.4.0-RC1", "samples");

        for (Map.Entry<Path, Path> entry : TestDataRegistry.SOURCE_TO_TARGET_ARTIFACT_MAPPING.entrySet()) {
            try {
                Path from = entry.getKey();
                Path to = entry.getValue();
                log.info("Zip from [{}] to [{}]", from, to);
                FileUtil.zip(from, to);
            } catch (IOException e) {
                throw new RuntimeException("Failed to zip archive for tests.", e);
            }
        }
    }
}
