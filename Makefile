VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-X github.com/maxcelos/wpmax/cmd.Version=$(VERSION)"

.PHONY: build install test lint clean release

build:
	go build $(LDFLAGS) -o bin/wpmax .

install:
	go install $(LDFLAGS) .

test:
	go test ./...

lint:
	go vet ./...

clean:
	rm -rf bin/ dist/

# Release: make release type=patch|minor|major
# Checks branch, calculates next version, tags, and pushes.
release:
	@[ "$(shell git rev-parse --abbrev-ref HEAD)" = "main" ] || (echo "Error: must be on main branch" && exit 1)
	@[ -z "$(shell git status --porcelain)" ] || (echo "Error: working tree is dirty" && exit 1)
	@CURRENT=$$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"); \
	MAJOR=$$(echo $$CURRENT | sed 's/v//' | cut -d. -f1); \
	MINOR=$$(echo $$CURRENT | sed 's/v//' | cut -d. -f2); \
	PATCH=$$(echo $$CURRENT | sed 's/v//' | cut -d. -f3); \
	TYPE=$(type); \
	if [ "$$TYPE" = "major" ]; then \
		MAJOR=$$((MAJOR + 1)); MINOR=0; PATCH=0; \
	elif [ "$$TYPE" = "minor" ]; then \
		MINOR=$$((MINOR + 1)); PATCH=0; \
	elif [ "$$TYPE" = "patch" ]; then \
		PATCH=$$((PATCH + 1)); \
	else \
		echo "Error: specify type=patch|minor|major"; exit 1; \
	fi; \
	NEXT="v$$MAJOR.$$MINOR.$$PATCH"; \
	echo "$$CURRENT -> $$NEXT"; \
	read -p "Confirm release $$NEXT? [y/N] " CONFIRM; \
	[ "$$CONFIRM" = "y" ] || { echo "Aborted"; exit 1; }; \
	git tag -a $$NEXT -m "Release $$NEXT" && \
	git push origin main --follow-tags && \
	echo "Released $$NEXT"