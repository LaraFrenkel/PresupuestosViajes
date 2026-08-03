USE app_presupuestos_viajes;

SELECT v.nombre, v.fecha_salida, v.fecha_regreso, v.estado,
       COUNT(p.id_participante) AS participantes_activos
FROM viajes v
LEFT JOIN participantes p ON p.id_viaje = v.id_viaje AND p.activo = TRUE
GROUP BY v.id_viaje
ORDER BY v.fecha_salida;
