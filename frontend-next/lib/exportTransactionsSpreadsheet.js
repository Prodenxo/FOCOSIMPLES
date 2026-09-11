function formatTransactionsForXlsx(transactions) {
  return transactions.map((t) => {
    let dataFormatada = '';
    if (t.data) {
      const dataObj = new Date(`${String(t.data).slice(0, 10)}T00:00:00-03:00`);
      dataFormatada = dataObj.toLocaleDateString('pt-BR');
    } else if (t.criado_em) {
      dataFormatada = new Date(t.criado_em).toLocaleDateString('pt-BR');
    }

    const valorNum = Number(t.valor) || 0;
    const valorFormatado = valorNum.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const tipoRaw = String(t.tipo || '').toLowerCase();
    const tipoFormatado = tipoRaw === 'entrada' ? 'RECEITA' : 'DESPESA';

    const statusRaw = String(t.status || '').toLowerCase();
    const statusFormatado =
      statusRaw === 'recebido' ? 'Recebido'
      : statusRaw === 'pago' ? 'Pago'
      : statusRaw === 'a_receber' ? 'A Receber'
      : statusRaw === 'a_pagar' ? 'A Pagar'
      : t.status ? String(t.status) : '';

    return {
      Descrição: t.classificacao || '',
      Valor: valorFormatado,
      Tipo: tipoFormatado,
      Data: dataFormatada,
      Status: statusFormatado,
      Observações: t.obs || '-',
    };
  });
}

export async function exportTransactionsToExcel(transactions) {
  if (!transactions.length) {
    throw new Error('Nenhuma transação para exportar com os filtros atuais.');
  }

  const XLSX = await import('xlsx');
  const dadosFormatados = formatTransactionsForXlsx(transactions);
  const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);
  worksheet['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 40 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transações');
  const fileName = `transacoes_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
