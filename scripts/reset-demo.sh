#!/bin/sh
# Fresh demo data, plus one run of the overdue job so the late ladder shows a reminder.
set -e
npx convex run seed:reset
npx convex run seed:run
docker compose exec -T -e N8N_RUNNERS_BROKER_PORT=5681 -e N8N_PORT=5690 n8n n8n execute --id=LLoverdueRemind1 >/dev/null
echo "Demo data ready."
