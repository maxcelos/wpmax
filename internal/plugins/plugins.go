package plugins

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/huh"
)

// LocalItem represents a local plugin or theme ZIP file.
type LocalItem struct {
	Name     string
	Filename string
}

// ScanLocalZips reads .zip files from a directory.
func ScanLocalZips(dir string) ([]LocalItem, error) {
	if dir == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var items []LocalItem
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".zip") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), filepath.Ext(e.Name()))
		items = append(items, LocalItem{Name: name, Filename: e.Name()})
	}
	return items, nil
}

// PromptSelection shows an interactive multi-select for items.
func PromptSelection(title string, localItems []LocalItem, publicItems []string) (selectedLocal []LocalItem, selectedPublic []string, err error) {
	type option struct {
		Label    string
		IsLocal  bool
		Index    int // index into localItems or publicItems
	}

	var options []huh.Option[int]
	var allOptions []option

	for i, item := range localItems {
		label := item.Name + " (local)"
		allOptions = append(allOptions, option{Label: label, IsLocal: true, Index: i})
		options = append(options, huh.NewOption(label, len(allOptions)-1))
	}
	for i, slug := range publicItems {
		label := slug + " (public)"
		allOptions = append(allOptions, option{Label: label, IsLocal: false, Index: i})
		options = append(options, huh.NewOption(label, len(allOptions)-1))
	}

	if len(options) == 0 {
		return nil, nil, nil
	}

	var selected []int
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewMultiSelect[int]().
				Title(title).
				Options(options...).
				Value(&selected),
		),
	)

	if err := form.Run(); err != nil {
		return nil, nil, err
	}

	for _, idx := range selected {
		opt := allOptions[idx]
		if opt.IsLocal {
			selectedLocal = append(selectedLocal, localItems[opt.Index])
		} else {
			selectedPublic = append(selectedPublic, publicItems[opt.Index])
		}
	}

	return selectedLocal, selectedPublic, nil
}
