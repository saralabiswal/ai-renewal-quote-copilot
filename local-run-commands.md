# Local run commands

From the repo root:

```bash
npm install
cp .env.example .env
npm run db:setup
make install-ml
npm run ml:generate-data
npm run ml:train
npm run ml:evaluate
npm run dev
```

Open:

- http://localhost:3000
- http://localhost:3000/renewal-cases

Optional:

```bash
npm run db:studio
npm run ml:serve
npm run build
```

Default local posture:

- Recommendation: `ML-Assisted Rules`
- LLM provider: `ollama`
- Guarded LLM can be selected from `Settings -> Technical View`
