PYTHON ?= $(shell if [ -x /Library/Frameworks/Python.framework/Versions/3.11/bin/python3 ]; then echo /Library/Frameworks/Python.framework/Versions/3.11/bin/python3; else command -v python3; fi)
ML_PYTHON ?= .venv-ml/bin/python
ML_SERVICE_PORT ?= 8010

.PHONY: standalone install-ml train-ml evaluate-ml serve-ml smoke-standalone

standalone: install-ml
	npm install
	npm run db:generate
	npm run db:push
	npm run db:seed
	npm run ml:generate-data
	npm run ml:train
	npm run ml:evaluate
	npm run lint

install-ml:
	$(PYTHON) -m venv .venv-ml
	$(ML_PYTHON) -m pip install -r ml/requirements.txt

train-ml:
	npm run ml:train

evaluate-ml:
	npm run ml:evaluate

serve-ml:
	ML_SERVICE_PORT=$(ML_SERVICE_PORT) npm run ml:serve

smoke-standalone:
	npm run ml:generate-data
	npm run ml:train
	npm run ml:evaluate
	npx tsc --noEmit --incremental false
	npm run lint
