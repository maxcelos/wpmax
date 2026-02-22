package compose

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"text/template"

	"github.com/maxcelos/wpmax/templates"
)

// SiteComposeData holds the data for rendering the per-site docker-compose.yml.
type SiteComposeData struct {
	Name         string
	DBUser       string
	DBPassword   string
	PluginsMount string
	ThemesMount  string
}

// Generate renders the docker-compose.yml template with the given data.
func Generate(data SiteComposeData) (string, error) {
	tmplData, err := templates.FS.ReadFile("docker-compose.yml.tmpl")
	if err != nil {
		return "", fmt.Errorf("reading compose template: %w", err)
	}
	tmpl, err := template.New("compose").Parse(string(tmplData))
	if err != nil {
		return "", fmt.Errorf("parsing compose template: %w", err)
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("executing compose template: %w", err)
	}
	return buf.String(), nil
}

// WriteTo renders and writes the docker-compose.yml to the given directory.
func WriteTo(dir string, data SiteComposeData) error {
	content, err := Generate(data)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "docker-compose.yml"), []byte(content), 0644)
}
