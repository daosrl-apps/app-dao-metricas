# DAO SRL - Panel de Control Financiero y Métricas

Esta aplicación proporciona un panel interactivo premium para visualizar el Estado de Resultados y los Indicadores Clave de Rendimiento (KPI) de **DAO SRL (Servicio de Pintura en Polvo Electrostática)**. 

El sistema está diseñado para cargarse de manera directa a partir de un archivo Excel de control administrativo y financiero.

---

## 🚀 Características Clave

1. **Estado de Resultados Interactivo**:
   - Visualización detallada del flujo financiero (Ingresos, CV, CMg, CF, Utilidad Bruta, Retiros, Utilidad Neta).
   - Modo Real vs Teórico (Fx).
   - Gráficos circulares de distribución de costos y barras de cascada conceptual.

2. **Módulo de Métricas y KPIs con Multiselector**:
   - Permite seleccionar múltiples variables simultáneamente (como Ingresos y M² Pintados).
   - **Doble Eje Y Dinámico**: Escala automáticamente las variables según su naturaleza (montos en millones de pesos vs. áreas en miles de m²) para que todas las curvas sean perfectamente legibles en un mismo gráfico.
   - Tooltip informativo compartido y formateado según la unidad de medida.
   - Selector dinámico de periodos históricos (promedio vs. meses específicos).

3. **Análisis de Clientes (Pareto 80/20)**:
   - Identificación automática de los clientes principales que representan el 80% de los m² pintados o de los ingresos totales en pesos ($).
   - Gráficos mixtos de columnas y línea de Pareto acumulativa.

4. **Actualización Directa en la Nube**:
   - Botón de carga integrado para subir el archivo Excel actualizado (`Resumen_InterAnual_2026.XLS`) directamente desde la interfaz, sin requerir acceso técnico al servidor.
   - Acceso restringido y protegido mediante credenciales de seguridad.

5. **Ajuste Móvil**:
   - Interfaz responsiva adaptada para teléfonos móviles.
   - Generación dinámica de favicones corporativos oscuros a partir del logo vectorial para un aspecto de app nativa.

---

## 🛠️ Stack Tecnológico

- **Backend**: Servidor HTTP nativo en Python (`server.py`) que expone una API REST ligera y utiliza la librería `xlrd` para el análisis bajo demanda del archivo de Excel.
- **Frontend**: SPA construida en HTML5, CSS3 (Glassmorphism & Dark Mode) y JavaScript Vanilla. Gráficos interactivos motorizados por **ApexCharts**.
- **Infraestructura**: Despliegue en contenedorizado mediante **Docker** y **Docker Compose** detrás de un proxy inverso **Nginx** de alto rendimiento.

---

## 🛡️ Buenas Prácticas de Seguridad Aplicadas

Para garantizar la estabilidad y protección del sistema en producción:
- **Aislamiento de Privilegios**: El contenedor de la aplicación Python se ejecuta con un usuario interno de privilegios limitados (`appuser`), reduciendo vectores de ataque en caso de vulnerabilidad.
- **Límites de Recursos (Docker Deploy)**: Se limitó el consumo máximo de memoria y CPU por contenedor para evitar ataques de denegación de servicio (DoS) por agotamiento de recursos.
- **Cabeceras de Seguridad Nginx**: El proxy inverso Nginx inyecta cabeceras HTTP de protección como `X-Frame-Options` (contra clickjacking), `X-Content-Type-Options` (evita spoofing), y una estricta política de seguridad de contenido (`Content-Security-Policy`).
- **Nginx como Servidor de Estáticos**: Los archivos HTML/CSS/JS se sirven directamente mediante Nginx con volumen de sólo lectura (`ro`), mejorando la velocidad y seguridad.

---

## 💾 Estrategia de Backups Automáticos

Los datos residen de forma persistente en el archivo `Resumen_InterAnual_2026.XLS` dentro de un volumen administrado por Docker.
El script de respaldo automatizado (`backup.sh`):
1. Extrae de forma segura el archivo del contenedor en ejecución mediante `docker cp`.
2. Guarda el respaldo en el directorio `/home/root/backups/app-dao-metricas` etiquetándolo con fecha y hora (`YYYYMMDD_HHMMSS`).
3. Mantiene una rotación automática conservando únicamente los últimos 30 días de historial para optimizar el almacenamiento.

Se puede programar una ejecución diaria en el cron de la máquina virtual con:
```bash
0 3 * * * /bin/bash /home/root/app-dao-metricas/backup.sh
```

---

## 🐳 Despliegue con Docker Compose

### Requisitos previos:
1. Tener instalado Docker y Docker Compose en la VM.
2. Descargar el repositorio en la carpeta del servidor.

### Comandos de administración:

* **Iniciar la aplicación (en segundo plano)**:
  ```bash
  docker compose up -d --build
  ```
* **Detener la aplicación**:
  ```bash
  docker compose down
  ```
* **Ver los registros de la app**:
  ```bash
  docker compose logs -f app
  ```
* **Ver los registros del proxy web (Nginx)**:
  ```bash
  docker compose logs -f web
  ```
