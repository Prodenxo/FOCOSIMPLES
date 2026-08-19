# Foco Simples — API Bot (OpenClaw)

## Chamadas
- **SEMPRE:** `/home/node/.openclaw/workspace/mf-curl.sh TELEFONE55 '{"action":"...","payload":{}}'`
- **NUNCA:** curl com `$MF_API_URL` / `$OPENCLAW_WEBHOOK_SECRET` (exec não herda env)
- `phone` = dígitos com DDI **55** do remetente do WhatsApp

## DAS (PDF no WhatsApp)
```bash
/home/node/.openclaw/workspace/mf-das-send.sh 5521996185328 03/2026
```
Só confirmar se JSON tiver `"whatsapp":"sent"`.
Proibido: só get_das_current / base64 no chat.

## NFS-e PDF
```bash
/home/node/.openclaw/workspace/mf-nfse-send.sh 5521996185328 UUID_DA_NOTA
```

## NFS-e vs NF-e (não misturar)
- **Produto** (camisa, mercadoria, NF-e) → `list_nfe_produtos` → `preview_nfe` → `emit_nfe`
- **Serviço** (NFS-e) → `list_catalog_servicos` → `preview_nfse` → `emit_nfse`
- Nunca inventar preview sem JSON da API. Nunca `servicoIndice` em pedido de produto.

## Actions principais
ping, resolve_user, list_roles, get_permissions, check_permission,
list_access_requests, approve_access_request, reject_access_request,
list_contas, get_saldo, create_conta, update_conta, delete_conta,
list_categories, list_transactions, create_transaction, update_transaction, delete_transaction,
list_calendar_events, list_upcoming_calendar_events, get_next_calendar_event,
create_calendar_event, delete_calendar_event, add_calendar_event_meet,
list_agenda_checklist_today, complete_calendar_event, get_google_calendar_status,
get_das_current, get_das_payment_status, send_das_whatsapp, refresh_das_pdf,
get_nfse_setup_status, sync_nfse_emitente,
list_nfse_clientes, register_nfse_cliente, list_nfse_produtos, register_nfse_produto,
list_catalog_servicos, preview_nfse, emit_nfse, list_nfse_notas, consult_nfse, get_nfse_pdf, send_nfse_whatsapp,
list_nfe_produtos, register_nfe_cliente, register_nfe_produto, preview_nfe, emit_nfe
