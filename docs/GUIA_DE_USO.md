# Guía de uso de Brújula

## 1. Crear el viaje

Después de registrarte, elegí **Nuevo viaje**. Cargá las fechas, la moneda principal y los datos generales. La moneda principal se usa como referencia, pero el viaje puede tener movimientos en varias monedas.

La tarjeta completa abre el viaje. **Archivar** lo oculta de los viajes activos sin borrar información. Para eliminarlo definitivamente, abrilo, elegí **Editar viaje** y luego **Eliminar viaje**. Esta última acción requiere escribir el nombre y no se puede deshacer.

## 2. Agregar participantes

En **Participantes**, cargá a todas las personas del grupo. Una participante puede desactivarse para conservar su historial. Solo puede eliminarse si todavía no tiene movimientos asociados.

El detalle individual resume cuánto pagó, cuánto le correspondía y sus movimientos.

## 3. Comparar cotizaciones

En **Cotizaciones**, creá una alternativa por agencia o proveedor y desglosala en conceptos, por ejemplo:

- tarifa base;
- tasas e impuestos;
- propinas;
- seguro;
- plan de bebidas;
- traslados.

El **importe** es el precio base. La modalidad determina el cálculo:

- **Total:** se aplica una vez.
- **Por persona:** importe por cantidad de participantes.
- **Por noche:** importe por cantidad de noches.
- **Por persona/noche:** importe por participantes y noches.

Un concepto puede aplicar a todo el grupo o solo a participantes seleccionadas. **Comparar** normaliza las alternativas a la moneda principal; si falta una conversión, hay que cargarla en **Monedas**.

Al seleccionar una cotización se crea una versión independiente del presupuesto. Editar después la cotización no modifica retroactivamente ese presupuesto.

## 4. Armar el presupuesto

En **Presupuesto y planes** se encuentran:

- **Conceptos y planes:** costos confirmados y ajustes posteriores.
- **Excursiones:** alternativas por puerto, precio por persona y participantes.
- **Cuotas y vencimientos:** compromisos de pago con fecha e importe.
- **Pagos:** dinero efectivamente abonado.

Una cuota es una parte programada de un concepto. Por ejemplo, una reserva de USD 900 puede dividirse en seña de USD 300 y saldo de USD 600.

## 5. Registrar un pago

Cada pago necesita tres distribuciones cuya suma debe coincidir con el importe total:

1. **Quién pagó:** de qué participante salió el dinero.
2. **A quién correspondía:** quiénes recibieron el beneficio económico.
3. **Aplicar a:** qué conceptos o cuotas quedaron pagados.

Ejemplo: Nay paga USD 300 por una cuota que corresponde en partes iguales a Nay, Sofi y Stephie. En “Quién pagó”, Nay tiene 300. En “A quién correspondía”, cada una tiene 100. En “Aplicar a”, la cuota tiene 300.

Un pago incorrecto puede **revertirse**. Permanece en el historial, pero deja de afectar cuotas y balances.

## 6. Registrar gastos del viaje

En **Gastos**, cargá consumos reales como comidas, taxis o entradas. Indicá quién pagó y cómo se divide. La división puede ser igual o personalizada.

No dupliques un mismo movimiento como pago de presupuesto y como gasto real salvo que realmente sean operaciones diferentes, porque ambos afectan el balance del grupo.

## 7. Monedas y tipos de cambio

En **Monedas** se administran las conversiones. La tasa expresa cuántas unidades de la moneda destino equivalen a una unidad de la moneda origen.

Ejemplo: si `1 USD = 1.300 ARS`, el origen es USD, el destino ARS y la tasa es 1300. Las equivalencias son informativas: cada movimiento conserva su moneda e importe original.

## 8. Balances y transferencias

En **Balances**:

- un saldo positivo debe recibir dinero;
- un saldo negativo debe pagar;
- un saldo cero está saldado.

La aplicación propone transferencias para cancelar las deudas con la menor cantidad de movimientos posible. Primero se registra la transferencia pendiente y después se marca como realizada. Una transferencia realizada desaparece de las deudas pendientes y queda en el historial único.

El selector de moneda del historial cambia solamente la equivalencia mostrada; no altera el movimiento original.

## Flujo recomendado

1. Crear viaje y participantes.
2. Cargar y comparar cotizaciones.
3. Seleccionar una y confirmar el presupuesto.
4. Agregar planes, excursiones y cuotas.
5. Registrar cada pago real.
6. Durante el viaje, cargar gastos adicionales.
7. Mantener actualizados los tipos de cambio.
8. Revisar balances y registrar transferencias hasta que el grupo quede saldado.
