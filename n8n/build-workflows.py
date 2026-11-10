"""Builds n8n/workflows/*.json from the Code node sources in n8n/src.
Run: python3 n8n/build-workflows.py   (the JSON files are committed; this only regenerates them)"""
import json, pathlib

ROOT = pathlib.Path(__file__).parent
src = lambda name: (ROOT / "src" / name).read_text()

def code(id_, name, file, pos):
    return {"id": id_, "name": name, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": pos,
            "parameters": {"jsCode": src(file)}}

def post_signed(id_, name, path, pos):
    """Signed POST to Convex with 3 tries, 5 s apart."""
    return {"id": id_, "name": name, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": pos,
            "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000,
            "parameters": {
                "method": "POST", "url": f"={{{{ $env.CONVEX_SITE_URL }}}}{path}",
                "sendHeaders": True,
                "headerParameters": {"parameters": [{"name": "X-LendLoop-Signature", "value": "={{ $json.signature }}"}]},
                "sendBody": True, "contentType": "raw", "rawContentType": "application/json",
                "body": "={{ $json.body }}",
                "options": {"timeout": 10000}}}

def conn(*pairs):
    out = {}
    for a, b, *idx in pairs:
        i = idx[0] if idx else 0
        out.setdefault(a, {"main": []})
        while len(out[a]["main"]) <= i:
            out[a]["main"].append([])
        out[a]["main"][i].append({"node": b, "type": "main", "index": 0})
    return out

ERROR_ID = "LLerrorHandler01"
settings = {"executionOrder": "v1", "errorWorkflow": ERROR_ID, "saveDataErrorExecution": "all"}

notifications = {
    "id": "LLnotifications1", "name": "LendLoop: loan notifications", "active": False, "settings": settings,
    "nodes": [
        {"id": "n1", "name": "Loan event from LendLoop", "type": "n8n-nodes-base.webhook", "typeVersion": 2,
         "position": [0, 0], "webhookId": "0b7c3e52-4a8e-4d3e-9f39-1e2d7c1a5b11",
         "parameters": {"httpMethod": "POST", "path": "lendloop-loan-events", "responseMode": "responseNode",
                        "options": {"rawBody": True}}},
        code("n2", "Verify signature", "verify.js", [220, 0]),
        {"id": "n3", "name": "Signature valid?", "type": "n8n-nodes-base.if", "typeVersion": 2, "position": [440, 0],
         "parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                        "conditions": [{"id": "c1", "leftValue": "={{ $json.valid }}", "rightValue": True,
                                        "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                        "combinator": "and"}, "options": {}}},
        code("n4", "Send notice (mock email)", "notice.js", [660, -100]),
        code("n5", "Sign write-back", "sign-notice.js", [880, -100]),
        post_signed("n6", "Record notice in LendLoop", "/n8n/events", [1100, -100]),
        {"id": "n7", "name": "Reply 200", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
         "position": [1320, -100],
         "parameters": {"respondWith": "json", "responseBody": "={{ { ok: true } }}", "options": {"responseCode": 200}}},
        {"id": "n8", "name": "Reply 401", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
         "position": [660, 120],
         "parameters": {"respondWith": "json", "responseBody": "={{ { error: 'Invalid signature' } }}",
                        "options": {"responseCode": 401}}},
    ],
    "connections": conn(("Loan event from LendLoop", "Verify signature"), ("Verify signature", "Signature valid?"),
                        ("Signature valid?", "Send notice (mock email)", 0), ("Signature valid?", "Reply 401", 1),
                        ("Send notice (mock email)", "Sign write-back"), ("Sign write-back", "Record notice in LendLoop"),
                        ("Record notice in LendLoop", "Reply 200")),
}

reminders = {
    "id": "LLoverdueRemind1", "name": "LendLoop: daily overdue reminders", "active": False, "settings": settings,
    "nodes": [
        {"id": "r1", "name": "Every day at 08:00 UTC", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2,
         "position": [0, 0], "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 8 * * *"}]}}},
        {"id": "r0", "name": "Run now (manual)", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1,
         "position": [0, 180], "parameters": {}},
        code("r2", "Sign request", "sign-overdue.js", [220, 0]),
        post_signed("r3", "Get overdue loans", "/n8n/overdue", [440, 0]),
        code("r4", "Send reminders (mock email)", "reminders.js", [660, 0]),
        post_signed("r5", "Record reminder in LendLoop", "/n8n/events", [880, 0]),
    ],
    "connections": conn(("Every day at 08:00 UTC", "Sign request"), ("Run now (manual)", "Sign request"), ("Sign request", "Get overdue loans"),
                        ("Get overdue loans", "Send reminders (mock email)"),
                        ("Send reminders (mock email)", "Record reminder in LendLoop")),
}

errors = {
    "id": ERROR_ID, "name": "LendLoop: error handler", "active": False,
    "settings": {"executionOrder": "v1"},
    "nodes": [
        {"id": "e1", "name": "When a LendLoop workflow fails", "type": "n8n-nodes-base.errorTrigger", "typeVersion": 1,
         "position": [0, 0], "parameters": {}},
        code("e2", "Sign failure report", "sign-error.js", [220, 0]),
        post_signed("e3", "Report failure to LendLoop", "/n8n/events", [440, 0]),
    ],
    "connections": conn(("When a LendLoop workflow fails", "Sign failure report"),
                        ("Sign failure report", "Report failure to LendLoop")),
}

for fname, wf in [("loan-notifications.json", notifications), ("overdue-reminders.json", reminders),
                  ("error-handler.json", errors)]:
    wf.setdefault("pinData", {})
    (ROOT / "workflows" / fname).write_text(json.dumps(wf, indent=2) + "\n")
    print("wrote", fname)
