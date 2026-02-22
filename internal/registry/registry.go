package registry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/maxcelos/wpmax/internal/config"
)

type Site struct {
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"createdAt"`
}

type Registry struct {
	Sites []Site `json:"sites"`
}

func registryPath() string {
	return filepath.Join(config.Dir(), "sites.json")
}

func Load() (Registry, error) {
	var reg Registry
	data, err := os.ReadFile(registryPath())
	if err != nil {
		if os.IsNotExist(err) {
			return reg, nil
		}
		return reg, err
	}
	if err := json.Unmarshal(data, &reg); err != nil {
		return Registry{}, err
	}
	return reg, nil
}

func Save(reg Registry) error {
	data, err := json.MarshalIndent(reg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(registryPath(), data, 0644)
}

func Add(site Site) error {
	reg, err := Load()
	if err != nil {
		return err
	}
	for _, s := range reg.Sites {
		if s.Name == site.Name {
			return fmt.Errorf("site %q already registered", site.Name)
		}
	}
	reg.Sites = append(reg.Sites, site)
	return Save(reg)
}

func Remove(name string) error {
	reg, err := Load()
	if err != nil {
		return err
	}
	filtered := make([]Site, 0, len(reg.Sites))
	for _, s := range reg.Sites {
		if s.Name != name {
			filtered = append(filtered, s)
		}
	}
	reg.Sites = filtered
	return Save(reg)
}

func Get(name string) (Site, error) {
	reg, err := Load()
	if err != nil {
		return Site{}, err
	}
	for _, s := range reg.Sites {
		if s.Name == name {
			return s, nil
		}
	}
	return Site{}, fmt.Errorf("site %q not found", name)
}

func List() ([]Site, error) {
	reg, err := Load()
	if err != nil {
		return nil, err
	}
	return reg.Sites, nil
}

func Exists(name string) bool {
	_, err := Get(name)
	return err == nil
}
