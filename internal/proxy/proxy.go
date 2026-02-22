package proxy

import (
	"fmt"
	"os"
	"path/filepath"
	"text/template"

	"github.com/maxcelos/wpmax/internal/config"
	"github.com/maxcelos/wpmax/internal/docker"
	"github.com/maxcelos/wpmax/templates"
)

const proxyContainer = "wpmax_proxy"

// EnsureProxyDir creates the proxy directory structure and writes base configs.
func EnsureProxyDir() error {
	if err := config.EnsureDirs(); err != nil {
		return err
	}
	return WriteBaseConfigs()
}

// WriteBaseConfigs writes nginx.conf and docker-compose.yml to the proxy directory.
func WriteBaseConfigs() error {
	// Write nginx.conf
	nginxConf, err := templates.FS.ReadFile("nginx.conf")
	if err != nil {
		return fmt.Errorf("reading nginx.conf template: %w", err)
	}
	if err := os.WriteFile(filepath.Join(config.ProxyDir(), "nginx.conf"), nginxConf, 0644); err != nil {
		return err
	}

	// Write docker-compose.yml
	composeData, err := templates.FS.ReadFile("proxy-compose.yml")
	if err != nil {
		return fmt.Errorf("reading proxy-compose.yml template: %w", err)
	}
	return os.WriteFile(filepath.Join(config.ProxyDir(), "docker-compose.yml"), composeData, 0644)
}

// Start launches the shared Nginx proxy.
func Start() error {
	if err := EnsureProxyDir(); err != nil {
		return err
	}
	// Set WPMAX_CERTS_DIR env for compose
	os.Setenv("WPMAX_CERTS_DIR", config.CertsDir())
	return docker.ComposeUp(docker.ProxyProject, config.ProxyDir())
}

// Stop shuts down the shared Nginx proxy.
func Stop() error {
	return docker.ComposeDown(docker.ProxyProject, config.ProxyDir(), false)
}

// IsRunning checks if the proxy container is running.
func IsRunning() bool {
	return docker.ContainerRunning(proxyContainer)
}

type siteData struct {
	Name string
}

// AddSiteConf generates and writes an nginx vhost config for a site.
func AddSiteConf(name string) error {
	tmplData, err := templates.FS.ReadFile("nginx-site.conf.tmpl")
	if err != nil {
		return fmt.Errorf("reading site template: %w", err)
	}
	tmpl, err := template.New("site").Parse(string(tmplData))
	if err != nil {
		return fmt.Errorf("parsing site template: %w", err)
	}
	confPath := filepath.Join(config.ProxyConfDir(), name+".conf")
	f, err := os.Create(confPath)
	if err != nil {
		return err
	}
	defer f.Close()
	return tmpl.Execute(f, siteData{Name: name})
}

// RemoveSiteConf deletes the nginx vhost config for a site.
func RemoveSiteConf(name string) error {
	confPath := filepath.Join(config.ProxyConfDir(), name+".conf")
	if err := os.Remove(confPath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// Reload sends a reload signal to the proxy container.
func Reload() error {
	if !IsRunning() {
		return fmt.Errorf("proxy is not running")
	}
	_, err := docker.Exec(proxyContainer, "nginx", "-s", "reload")
	return err
}
