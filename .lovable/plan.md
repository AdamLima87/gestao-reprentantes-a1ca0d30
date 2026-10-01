# Revisão da regra de 120 dias

## Objetivo
Aplicar a mesma regra a todas as notas: venda interna sem representante recebe 1,5% quando não existe compra anterior ou quando o intervalo desde a compra anterior é maior que 120 dias; com intervalo de até 120 dias, recebe 1%.

## Implementação
- Corrigir o cálculo individual de novas notas para buscar a compra anterior real do cliente no histórico, sem depender apenas da data acumulada no cadastro.
- Alinhar o recálculo geral à mesma regra cronológica, mantendo os percentuais manuais dos pedidos como prioridade.
- Recalcular todas as comissões existentes para corrigir classificações históricas, valores e colunas dos relatórios.
- Conferir a NF 876 e uma amostra de clientes novos, recorrentes e reativados após o recálculo.

## Detalhes técnicos
- A comparação será feita pela data da NF anterior do mesmo cliente, em ordem cronológica.
- O limite é estrito: mais de 120 dias = 1,5%; 120 dias ou menos = 1%.
- As bases permanecem no valor dos produtos, e comissões de representante e gestor não terão suas regras alteradas.
