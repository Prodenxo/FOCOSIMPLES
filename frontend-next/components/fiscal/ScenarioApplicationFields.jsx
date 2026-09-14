'use client';

import { AppSelect } from '@/components/ui/AppSelect';
import {
  FINAL_CONSUMER_CONDITION_OPTIONS,
  RECIPIENT_TAXPAYER_CONDITION_OPTIONS,
  SCENARIO_APPLIES_OPTIONS,
} from '@/lib/fiscalConfiguration/labels';
import { applyScenarioAppliesPatch } from '@/lib/fiscalConfiguration/scenarioApplicationUi';

function inputClass() {
  return 'h-10 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-sm';
}

export function ScenarioApplicationFields({ form, onChange, readOnly = false }) {
  const patch = (next) => {
    onChange(applyScenarioAppliesPatch(next, form));
  };

  const recipientConditionValue = form.restrictRecipientTaxpayer
    ? form.recipientTaxpayerStatus
    : 'ANY';

  const consumerConditionValue = form.restrictFinalConsumer
    ? form.recipientFinalConsumer
    : 'ANY';

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[var(--text-muted)]">
        Condições de aplicação do tratamento fiscal — não são dados fixos do produto.
        Na emissão, UF emitente, UF destino e abrangência vêm do destinatário e do estabelecimento.
      </p>

      <AppSelect
        label="Aplica-se em"
        value={form.scenarioApplies ?? 'INTERNAL'}
        onChange={(v) => patch({ scenarioApplies: v })}
        options={SCENARIO_APPLIES_OPTIONS}
        disabled={readOnly}
      />

      {form.scenarioApplies === 'INTERSTATE_UF' ? (
        <label className="block text-xs text-[var(--text-muted)]">
          UF destino específica
          <input
            className={`mt-1 ${inputClass()}`}
            value={form.specificDestinationUf ?? ''}
            onChange={(e) => patch({ specificDestinationUf: e.target.value.toUpperCase().slice(0, 2) })}
            disabled={readOnly}
            placeholder="Ex.: SP"
          />
        </label>
      ) : null}

      <div className="space-y-2 rounded-[12px] border border-dashed border-[var(--card-border)] p-3">
        <p className="text-xs font-semibold text-[var(--text-muted)]">Restrições opcionais do destinatário</p>
        <p className="text-xs text-[var(--text-muted)]">
          Deixe em &quot;Qualquer&quot; para regras genéricas.
        </p>
        <AppSelect
          label="Destinatário"
          value={recipientConditionValue}
          onChange={(v) => {
            if (v === 'ANY') {
              onChange({
                restrictRecipientTaxpayer: false,
                recipientTaxpayerStatus: 'UNKNOWN',
              });
              return;
            }
            onChange({
              restrictRecipientTaxpayer: true,
              recipientTaxpayerStatus: v,
            });
          }}
          options={RECIPIENT_TAXPAYER_CONDITION_OPTIONS}
          disabled={readOnly}
        />
        <AppSelect
          label="Consumidor"
          value={consumerConditionValue}
          onChange={(v) => {
            if (v === 'ANY') {
              onChange({
                restrictFinalConsumer: false,
                recipientFinalConsumer: 'UNKNOWN',
              });
              return;
            }
            onChange({
              restrictFinalConsumer: true,
              recipientFinalConsumer: v,
            });
          }}
          options={FINAL_CONSUMER_CONDITION_OPTIONS}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
