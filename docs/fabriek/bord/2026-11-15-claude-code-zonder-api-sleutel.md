- **Claude Code betaalt niet meer stilletjes via de API:** een eval met `claude-code::…` draait
  nu echt op het abonnement. Stond er een `ANTHROPIC_API_KEY` in `.env` of de terminal, dan gaf
  de app die door aan Claude Code, en die rekende dan via de API af. De app haalt die sleutel
  (en `ANTHROPIC_AUTH_TOKEN`) nu weg voordat Claude Code start.
