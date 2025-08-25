.PHONY: help install clean colors reset start lint lint-fix typecheck doctor check eas-dev-ios eas-dev-android eas-build-ios eas-build-android credentials-ios eas-submit-ios eas-submit-android env-check logs version update-deps security

help:
	@echo ""
	@grep -E '^[a-zA-Z_-]+:' $(MAKEFILE_LIST) | grep -v '^#' | sed 's/:.*$$//' | sort | uniq | sed 's/^/  /' | awk '{printf "\033[36m%-20s\033[0m\n", $$1}'

install:
	rm -rf node_modules package-lock.json
	npm install
	npx expo install

clean:
	rm -rf node_modules package-lock.json
	npm cache clean --force
	npm install
	npx expo install

colors:
	@echo ""
	@echo "  $$eist-primary:   #4733FF"
	@echo "  $$eist-secondary: #AFFC41"
	@echo "  $$eist-highlight: #96BFE6"

reset:
	node ./scripts/reset-project.js

start:
	npx expo start --tunnel --clear

lint:
	npm run lint

lint-fix:
	npx expo lint --fix

typecheck:
	npx tsc --noEmit --project .

doctor:
	npx expo-doctor

check: lint typecheck doctor

eas-dev-ios:
	eas build --platform ios --profile development

eas-dev-android:
	eas build --platform android --profile development

eas-build-ios:
	eas build --platform ios

eas-submit-ios:
	eas submit --platform ios

eas-build-android:
	eas build --platform android

eas-submit-android:
	eas submit --platform android

credentials-ios:
	eas credentials --platform ios

env-check:
	@echo "Checking environment variables..."
	@test -f .env && echo ".env file exists" || echo "WARNING: .env file not found"
	@echo "NODE_ENV: $${NODE_ENV:-not set}"

logs:
	npx expo logs

version:
	@echo "Current version: $$(node -p "require('./package.json').version")"
	@echo "Expo SDK version: $$(node -p "require('./package.json').dependencies.expo")"

update-deps:
	npx expo install --fix
	npm update

security:
	npm audit
	npm audit fix
