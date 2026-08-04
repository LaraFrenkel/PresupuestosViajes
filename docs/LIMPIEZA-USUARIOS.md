# Limpieza selectiva de usuarios

Este procedimiento conserva una sola cuenta y sus viajes. Elimina las demás
cuentas, los viajes que les pertenecen y todo el historial administrativo.
No reinicia identificadores ni modifica la estructura de la base.

1. Crear o verificar una copia de seguridad en Aiven.
2. Configurar `KEEP_USER_EMAIL` con el correo que debe conservarse.
3. Ejecutar la vista previa: `npm run db:clean-users`.
4. Revisar las cantidades informadas. La vista previa no modifica datos.
5. Solo para confirmar, configurar
   `CONFIRM_CLEAN_USERS=ELIMINAR_USUARIOS` y ejecutar
   `npm run db:clean-users -- --execute`.

Si la cuenta indicada no existe exactamente una vez o falta la frase de
confirmación, el comando cancela la transacción sin eliminar datos.
