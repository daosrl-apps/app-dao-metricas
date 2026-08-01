// ==========================================================================
// DAO SRL - LÓGICA DE NEGOCIO INTERACTIVA & VISUALIZACIÓN DE MÉTRICAS
// ==========================================================================

// Estado global de la aplicación
const state = {
    data: null,
    selectedPeriod: 'media', // 'media' o fecha 'YYYY-MM-DD'
    selectedOrigen: 'R',     // 'R' (Real) o 'Fx' (Teórico)
    selectedKPIs: ['er-r-vs-fx'], // Lista de KPIs/Elementos seleccionados
    charts: {} // Referencias de gráficos ApexCharts
};

// Traducciones de meses en español
const MESES_ES = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
};

// Formateadores de datos
function formatPeriodText(period) {
    if (period === 'media') return 'Promedio Últimos 12 Meses';
    const parts = period.split('-');
    if (parts.length === 3) {
        return `${MESES_ES[parts[1]]} ${parts[0]}`;
    }
    return period;
}

function formatCurrency(val) {
    if (val === undefined || isNaN(val) || val === null) return '$ 0';
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    
    if (absVal >= 1000000) {
        const millions = absVal / 1000000;
        const formatted = millions.toFixed(2).replace('.', ',');
        return isNegative ? `($ ${formatted} M)` : `$ ${formatted} M`;
    } else {
        const formatted = Math.round(absVal).toLocaleString('es-AR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        return isNegative ? `($ ${formatted})` : `$ ${formatted}`;
    }
}

function formatM2(val) {
    if (val === undefined || isNaN(val) || val === null) return '0 m²';
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    
    if (absVal >= 1000000) {
        const millions = absVal / 1000000;
        const formatted = millions.toFixed(2).replace('.', ',');
        return `${isNegative ? '-' : ''}${formatted} M m²`;
    } else {
        const formatted = Math.round(absVal).toLocaleString('es-AR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        return `${isNegative ? '-' : ''}${formatted} m²`;
    }
}

function formatPercentage(val, base) {
    if (!base || isNaN(val) || isNaN(base)) return '0,0%';
    const pct = (val / base) * 100;
    return `${pct.toLocaleString('es-AR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })}%`;
}

const TOKEN_KEY = 'dao_auth_token';

function showLogin() {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

function showApp() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
}

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Generar iconos dinámicos para navegadores móviles y escritorio
    generateDynamicIcons();
    
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        showApp();
        loadData();
    } else {
        showLogin();
    }
    setupEventListeners();
});

// Carga de datos desde la API del backend
async function loadData() {
    const badge = document.getElementById('data-status-badge');
    try {
        badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando...';
        badge.className = 'badge';
        badge.style.background = 'rgba(245, 158, 11, 0.15)';
        badge.style.color = 'var(--color-warning)';
        
        const token = localStorage.getItem(TOKEN_KEY);
        const response = await fetch('/api/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            showLogin();
            return;
        }
        
        if (!response.ok) throw new Error('Error al conectar con la API');
        
        state.data = await response.json();
        
        if (state.data.error) {
            throw new Error(state.data.error);
        }
        
        // Carga exitosa
        badge.innerHTML = '<i class="fa-solid fa-database"></i> Excel Conectado';
        badge.className = 'badge badge-success';
        badge.style.background = '';
        badge.style.color = '';
        
        populatePeriodSelect();
        renderER();
        renderKPI();
        
    } catch (error) {
        console.error(error);
        badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error al cargar';
        badge.style.background = 'rgba(239, 68, 68, 0.15)';
        badge.style.color = 'var(--color-danger)';
        alert('Hubo un problema al leer el archivo Excel. Asegúrate de que "Resumen_InterAnual_2026.XLS" esté en la carpeta del proyecto y que no esté abierto en otra aplicación.');
    }
}

// Rellenar selector de periodos
function populatePeriodSelect() {
    const select = document.getElementById('select-periodo');
    select.innerHTML = '';
    
    // Opción del promedio de los últimos 12 meses (Siempre al principio)
    const optMedia = document.createElement('option');
    optMedia.value = 'media';
    optMedia.textContent = 'Promedio Últimos 12 Meses';
    select.appendChild(optMedia);
    
    // Cargar los meses cronológicamente
    state.data.meses.forEach(month => {
        const opt = document.createElement('option');
        opt.value = month;
        opt.textContent = formatPeriodText(month);
        select.appendChild(opt);
    });
    
    // Seleccionar por defecto la 'media'
    select.value = 'media';
    state.selectedPeriod = 'media';

    // Rellenar también el selector de periodos de Métricas
    const selectKPI = document.getElementById('select-kpi-periodo');
    if (selectKPI) {
        selectKPI.innerHTML = '';
        
        // Agregar opción de Promedio
        const optMediaKPI = document.createElement('option');
        optMediaKPI.value = 'media';
        optMediaKPI.textContent = 'Promedio Últimos 12 Meses';
        selectKPI.appendChild(optMediaKPI);
        
        // Agregar los meses cronológicamente
        state.data.meses.forEach(month => {
            const opt = document.createElement('option');
            opt.value = month;
            opt.textContent = formatPeriodText(month);
            selectKPI.appendChild(opt);
        });
        
        // Seleccionar por defecto el último mes
        const ultimoMes = state.data.ultimo_mes;
        selectKPI.value = ultimoMes;
        state.selectedKPIPeriod = ultimoMes;
    }
}

// Configurar escuchadores de eventos
function setupEventListeners() {
    // Formulario de Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('login-error-msg');
            const card = document.querySelector('.login-card');
            
            try {
                errorMsg.classList.add('hidden');
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await response.json();
                if (response.ok && result.token) {
                    localStorage.setItem(TOKEN_KEY, result.token);
                    showApp();
                    loadData();
                } else {
                    throw new Error(result.error || 'Credenciales incorrectas');
                }
            } catch (err) {
                console.error(err);
                errorMsg.classList.remove('hidden');
                card.classList.add('shake');
                setTimeout(() => card.classList.remove('shake'), 300);
            }
        });
    }

    // Recarga de datos
    document.getElementById('btn-reload-data').addEventListener('click', () => {
        loadData();
    });
    
    // Subida de archivo Excel
    const btnUpload = document.getElementById('btn-upload-data');
    const inputFile = document.getElementById('input-file-excel');
    
    if (btnUpload && inputFile) {
        btnUpload.addEventListener('click', () => {
            inputFile.click();
        });
        
        inputFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const badge = document.getElementById('data-status-badge');
            try {
                badge.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-bounce"></i> Subiendo...';
                badge.className = 'badge';
                badge.style.background = 'rgba(245, 158, 11, 0.15)';
                badge.style.color = 'var(--color-warning)';
                
                const formData = new FormData();
                formData.append('file', file);
                
                const token = localStorage.getItem(TOKEN_KEY);
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                if (response.status === 401) {
                    localStorage.removeItem(TOKEN_KEY);
                    showLogin();
                    return;
                }
                
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Error en el servidor al subir el archivo');
                }
                
                alert('¡Archivo de Excel actualizado con éxito!');
                loadData(); // Recargar datos para refrescar la interfaz
                
            } catch (error) {
                console.error(error);
                alert('Error al subir el archivo: ' + error.message);
                loadData(); // Reestablecer estado del badge
            } finally {
                inputFile.value = ''; // Limpiar el input
            }
        });
    }
    
    // Tabs de navegación
    const btnER = document.getElementById('nav-btn-er');
    const btnMetricas = document.getElementById('nav-btn-metricas');
    const viewER = document.getElementById('view-estado-resultados');
    const viewMetricas = document.getElementById('view-metricas');
    
    btnER.addEventListener('click', () => {
        btnER.classList.add('active');
        btnMetricas.classList.remove('active');
        viewER.classList.remove('hidden');
        viewMetricas.classList.add('hidden');
        // Redibujar gráficos de ER para asegurar tamaño correcto
        setTimeout(renderERCharts, 50);
    });
    
    btnMetricas.addEventListener('click', () => {
        btnMetricas.classList.add('active');
        btnER.classList.remove('active');
        viewMetricas.classList.remove('hidden');
        viewER.classList.add('hidden');
        // Redibujar gráficos de Métricas para asegurar tamaño correcto
        setTimeout(renderKPICharts, 50);
    });
    
    // Cambios en Filtros de Estado de Resultados
    document.getElementById('select-periodo').addEventListener('change', (e) => {
        state.selectedPeriod = e.target.value;
        renderER();
    });
    
    document.getElementsByName('origen').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.selectedOrigen = e.target.value;
            renderER();
        });
    });
    
    // Inicializar y escuchar el nuevo multi-selector de variables
    setupMultiselect();

    // Cambio en selector de periodo de métricas
    document.getElementById('select-kpi-periodo').addEventListener('change', (e) => {
        state.selectedKPIPeriod = e.target.value;
        renderKPI();
    });
}

// Map of colors for elements
const COLOR_MAP = {
    'Ingresos': '#10b981',       // Verde
    'CV ®': '#ef4444',          // Rojo
    'CF ®': '#f59e0b',          // Naranja
    'CMg ®': '#06b6d4',         // Cian
    'M2': '#3b82f6',            // Azul
    'Precio/m2': '#8b5cf6',     // Violeta
    'CV ® /m2': '#ec4899',      // Rosa
    'CF ® /m2': '#64748b',      // Gris/Pizarra
    'CMg ® /m2': '#14b8a6'      // Teal
};

function setupMultiselect() {
    const trigger = document.getElementById('kpi-multiselect-trigger');
    const dropdown = document.getElementById('kpi-multiselect-dropdown');
    const multiselect = document.getElementById('kpi-multiselect');
    
    if (!trigger || !dropdown || !multiselect) return;
    
    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden');
        if (isHidden) {
            dropdown.classList.remove('hidden');
            multiselect.classList.add('active');
        } else {
            dropdown.classList.add('hidden');
            multiselect.classList.remove('active');
        }
    });
    
    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!multiselect.contains(e.target)) {
            dropdown.classList.add('hidden');
            multiselect.classList.remove('active');
        }
    });
    
    // Checkbox interaction
    const checkboxes = document.querySelectorAll('.kpi-checkbox');
    
    // Sincronizar checkboxes con el estado inicial
    checkboxes.forEach(chk => {
        chk.checked = state.selectedKPIs.includes(chk.value);
    });
    
    checkboxes.forEach(chk => {
        chk.addEventListener('change', (e) => {
            const currentChecked = e.target;
            const isChecked = currentChecked.checked;
            const type = currentChecked.dataset.type;
            
            if (isChecked) {
                if (type === 'report') {
                    // Desmarcar todos los demás
                    checkboxes.forEach(c => {
                        if (c !== currentChecked) {
                            c.checked = false;
                        }
                    });
                } else if (type === 'element') {
                    // Desmarcar todos los reportes
                    checkboxes.forEach(c => {
                        if (c.dataset.type === 'report') {
                            c.checked = false;
                        }
                    });
                }
            } else {
                // Si desmarcamos y no queda ninguno, volver a er-r-vs-fx
                const anyChecked = Array.from(checkboxes).some(c => c.checked);
                if (!anyChecked) {
                    const defaultReport = document.querySelector('.kpi-checkbox[value="er-r-vs-fx"]');
                    if (defaultReport) {
                        defaultReport.checked = true;
                    }
                }
            }
            
            // Actualizar estado
            state.selectedKPIs = Array.from(checkboxes)
                .filter(c => c.checked)
                .map(c => c.value);
            
            updateMultiselectTriggerText();
            renderKPI();
        });
    });
    
    updateMultiselectTriggerText();
}

function updateMultiselectTriggerText() {
    const checkboxes = document.querySelectorAll('.kpi-checkbox');
    const checked = Array.from(checkboxes).filter(c => c.checked);
    const triggerText = document.querySelector('#kpi-multiselect-trigger .trigger-text');
    if (!triggerText) return;
    
    if (checked.length === 0) {
        triggerText.textContent = "Seleccionar variables...";
    } else if (checked.length === 1) {
        const labelSpan = checked[0].nextElementSibling;
        triggerText.textContent = labelSpan ? labelSpan.textContent : checked[0].value;
    } else {
        const names = checked.map(c => {
            const val = c.value;
            if (val === 'CV ®') return 'CV';
            if (val === 'CF ®') return 'CF';
            if (val === 'CMg ®') return 'CMg';
            if (val === 'Precio/m2') return 'P. Vta/u';
            if (val === 'CV ® /m2') return 'CV/u';
            if (val === 'CF ® /m2') return 'CF/u';
            if (val === 'CMg ® /m2') return 'CMg/u';
            if (val === 'M2') return 'M²';
            return val;
        });
        
        if (names.length <= 3) {
            triggerText.textContent = names.join(', ');
        } else {
            triggerText.textContent = `${names.length} elementos seleccionados`;
        }
    }
}

// ==========================================================================
// RENDERIZADO: ESTADO DE RESULTADOS
// ==========================================================================
function renderER() {
    if (!state.data) return;
    
    const isMedia = state.selectedPeriod === 'media';
    const periodKey = state.selectedPeriod;
    const origen = state.selectedOrigen;
    
    // Actualizar títulos informativos
    document.getElementById('er-title-periodo').textContent = `Estado de Resultados - ${formatPeriodText(periodKey)}`;
    document.getElementById('er-badge-origen').textContent = origen === 'R' ? 'Real (R)' : 'Teórico (Fx)';
    
    // Obtener datos del resumen
    const getRowValue = (rowName) => {
        const row = state.data.resumen[rowName];
        if (!row) return 0;
        return isMedia ? row.media : (row.valores[periodKey] || 0);
    };
    
    // Extraer valores según origen (Real o Fx)
    const ingresos = getRowValue('Ingresos');
    
    const cvKey = origen === 'R' ? 'CV ®' : 'CV (Fx)';
    const cv = getRowValue(cvKey);
    
    const cmgKey = origen === 'R' ? 'CMg ®' : 'CMg (Fx)';
    const cmg = getRowValue(cmgKey);
    
    const cfKey = origen === 'R' ? 'CF ®' : 'CF (Fx)';
    const cf = getRowValue(cfKey);
    
    const rbKey = origen === 'R' ? 'R. Bruto (Fx)' : 'R. Bruto (Fx)'; // En Excel R. Bruto (Fx) y R. Bruto ® existen
    const rbActualKey = origen === 'R' ? 'R. Bruto ®' : 'R. Bruto (Fx)';
    const rb = getRowValue(rbActualKey);
    
    const retiros = getRowValue('Retiros Socios');
    
    // Calcular Resultado Neto
    const neto = rb - retiros;
    
    // Actualizar badges de fuentes en la tabla
    document.getElementById('badge-cv-source').textContent = origen;
    document.getElementById('badge-cf-source').textContent = origen;
    
    // Volcar valores en el DOM
    document.getElementById('val-ingresos').textContent = formatCurrency(ingresos);
    document.getElementById('val-cv').textContent = formatCurrency(-cv); // Se muestra restando
    document.getElementById('val-cmg').textContent = formatCurrency(cmg);
    document.getElementById('val-cf').textContent = formatCurrency(-cf); // Se muestra restando
    document.getElementById('val-rb').textContent = formatCurrency(rb);
    document.getElementById('val-retiros').textContent = formatCurrency(-retiros); // Se muestra restando
    
    const cellNeto = document.getElementById('val-neto');
    cellNeto.textContent = formatCurrency(neto);
    
    // Cambiar color de utilidad neta si es pérdida o ganancia
    if (neto < 0) {
        cellNeto.className = 'text-right cell-val text-danger';
    } else {
        cellNeto.className = 'text-right cell-val text-success';
    }
    
    // Volcar porcentajes sobre ventas
    document.getElementById('pct-ingresos').textContent = '100,0%';
    document.getElementById('pct-cv').textContent = formatPercentage(cv, ingresos);
    document.getElementById('pct-cmg').textContent = formatPercentage(cmg, ingresos);
    document.getElementById('pct-cf').textContent = formatPercentage(cf, ingresos);
    document.getElementById('pct-rb').textContent = formatPercentage(rb, ingresos);
    document.getElementById('pct-retiros').textContent = formatPercentage(retiros, ingresos);
    document.getElementById('pct-neto').textContent = formatPercentage(neto, ingresos);
    
    // Guardar valores en el estado para graficar
    state.currentERValues = { ingresos, cv, cmg, cf, rb, retiros, neto };
    
    // Renderizar gráficos
    renderERCharts();
}

function renderERCharts() {
    const vals = state.currentERValues;
    if (!vals) return;
    
    // 1. Gráfico de Torta: Distribución de Ingresos (dónde se va el dinero)
    // Solo si el resultado neto es positivo. Si es negativo, los costos superan las ventas,
    // por lo que representaremos los costos en relación a las ventas totales en un gráfico de barras.
    const chartDiv1 = document.getElementById('er-distribution-chart');
    chartDiv1.innerHTML = '';
    
    if (vals.neto >= 0) {
        const optionsPie = {
            chart: {
                type: 'donut',
                height: 280,
                foreColor: '#94a3b8'
            },
            series: [vals.cv, vals.cf, vals.retiros, vals.neto],
            labels: ['Costos Variables', 'Costos Fijos', 'Retiro Socios', 'Resultado Neto'],
            colors: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
            stroke: {
                show: false
            },
            legend: {
                position: 'bottom',
                horizontalAlign: 'center'
            },
            dataLabels: {
                formatter: function (val) {
                    return val.toFixed(1) + "%";
                }
            },
            tooltip: {
                y: {
                    formatter: function (val) {
                        return formatCurrency(val);
                    }
                }
            }
        };
        
        if (state.charts.erDistribution) state.charts.erDistribution.destroy();
        state.charts.erDistribution = new ApexCharts(chartDiv1, optionsPie);
        state.charts.erDistribution.render();
    } else {
        // En caso de resultado neto negativo, mostrar gráfico de columnas comparando ventas vs costos totales
        const optionsBar = {
            chart: {
                type: 'bar',
                height: 280,
                toolbar: { show: false },
                foreColor: '#94a3b8'
            },
            plotOptions: {
                bar: {
                    distributed: true,
                    borderRadius: 4,
                    columnWidth: '50%'
                }
            },
            series: [{
                name: 'Monto',
                data: [vals.ingresos, vals.cv + vals.cf + vals.retiros]
            }],
            dataLabels: {
                enabled: true,
                formatter: function(val) {
                    return formatCurrency(val);
                },
                style: { fontSize: '11px', colors: ["#f1f5f9"] }
            },
            yaxis: {
                labels: {
                    formatter: function(val) {
                        return formatCurrency(val);
                    }
                }
            },
            xaxis: {
                categories: ['Ingresos por Ventas', 'Costos Totales (CV+CF+Retiros)']
            },
            colors: ['#10b981', '#ef4444'],
            legend: { show: false },
            tooltip: {
                y: {
                    formatter: function (val) {
                        return formatCurrency(val);
                    }
                }
            }
        };
        
        if (state.charts.erDistribution) state.charts.erDistribution.destroy();
        state.charts.erDistribution = new ApexCharts(chartDiv1, optionsBar);
        state.charts.erDistribution.render();
    }
    
    // 2. Gráfico de Barras: Estructura Financiera Progresiva (Cascada conceptual)
    const chartDiv2 = document.getElementById('er-structure-chart');
    chartDiv2.innerHTML = '';
    
    const optionsCas = {
        chart: {
            type: 'bar',
            height: 280,
            toolbar: { show: false },
            foreColor: '#94a3b8'
        },
        plotOptions: {
            bar: {
                borderRadius: 4,
                columnWidth: '50%'
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function(val) {
                return formatCurrency(val);
            },
            style: { fontSize: '11px', colors: ["#f1f5f9"] }
        },
        yaxis: {
            labels: {
                formatter: function(val) {
                    return formatCurrency(val);
                }
            }
        },
        series: [{
            name: 'Monto',
            data: [vals.ingresos, vals.cmg, vals.rb, vals.neto]
        }],
        xaxis: {
            categories: ['Ingresos', 'Contrib. Marginal', 'Res. Bruto', 'Resultado Neto']
        },
        colors: [
            function({ value }) {
                if (value < 0) return '#ef4444';
                return '#1627b1';
            }
        ],
        tooltip: {
            y: {
                formatter: function (val) {
                    return formatCurrency(val);
                }
            }
        }
    };
    
    if (state.charts.erStructure) state.charts.erStructure.destroy();
    state.charts.erStructure = new ApexCharts(chartDiv2, optionsCas);
    state.charts.erStructure.render();
}

// ==========================================================================
// RENDERIZADO: METRICAS Y KPI
// ==========================================================================
function isReport(kpi) {
    const reports = [
        'er-r-vs-fx', 'cv-r-vs-fx', 'cf-r-vs-fx',
        'm2-pintados', 'pto-equilibrio',
        'pareto-m2', 'pareto-usd',
        'precio-m2', 'cv-m2', 'cmg-m2', 'cf-m2', 'rb-m2'
    ];
    return reports.includes(kpi);
}

function renderKPI() {
    if (!state.data) return;
    
    const kpis = state.selectedKPIs || ['er-r-vs-fx'];
    const period = state.selectedKPIPeriod || state.data.ultimo_mes;
    
    // Actualizar etiqueta del mes seleccionado
    document.getElementById('kpi-label-ultimo-mes').textContent = `${period === 'media' ? 'Periodo' : 'Mes'} Seleccionado (${formatPeriodText(period)})`;
    
    // Limpiar toggle de gráficos dinámicos
    const toggleContainer = document.getElementById('metric-chart-toggle');
    toggleContainer.innerHTML = '';
    
    // Caso 1: Es un reporte predefinido único (se evalúa si es de tipo "report")
    if (kpis.length === 1 && isReport(kpis[0])) {
        const kpi = kpis[0];
        let mediaVal = 0;
        let ultimoVal = 0;
        let title = "";
        let isCurrency = true;
        let isArea = false; // Define si es m2 o porcentaje
        
        if (kpi === 'er-r-vs-fx') {
            title = "Estado de Resultados: Real vs Teórico (Fx)";
            mediaVal = state.data.resumen['R. Bruto ®'].media;
            ultimoVal = period === 'media' ? state.data.resumen['R. Bruto ®'].media : (state.data.resumen['R. Bruto ®'].valores[period] || 0);
            document.getElementById('kpi-footer-media').textContent = "Promedio mensual del Resultado Bruto Real";
            document.getElementById('kpi-footer-ultimo').textContent = `Resultado Bruto Real de ${formatPeriodText(period)}`;
        } 
        else if (kpi === 'cv-r-vs-fx') {
            title = "Costos Variables Totales (CV): Real vs Teórico";
            mediaVal = state.data.resumen['CV ®'].media;
            ultimoVal = period === 'media' ? state.data.resumen['CV ®'].media : (state.data.resumen['CV ®'].valores[period] || 0);
            document.getElementById('kpi-footer-media').textContent = "Promedio mensual de CV Real";
            document.getElementById('kpi-footer-ultimo').textContent = `CV Real de ${formatPeriodText(period)}`;
        }
        else if (kpi === 'cf-r-vs-fx') {
            title = "Costos Fijos Totales (CF): Real vs Teórico";
            mediaVal = state.data.resumen['CF ®'].media;
            ultimoVal = period === 'media' ? state.data.resumen['CF ®'].media : (state.data.resumen['CF ®'].valores[period] || 0);
            document.getElementById('kpi-footer-media').textContent = "Promedio mensual de CF Real";
            document.getElementById('kpi-footer-ultimo').textContent = `CF Real de ${formatPeriodText(period)}`;
        }
        else if (kpi === 'm2-pintados') {
            title = "Metros Cuadrados (M²) Pintados";
            isCurrency = false;
            isArea = true;
            mediaVal = state.data.resumen['M2'].media;
            ultimoVal = period === 'media' ? state.data.resumen['M2'].media : (state.data.resumen['M2'].valores[period] || 0);
            document.getElementById('kpi-footer-media').textContent = "Promedio mensual de M² pintados";
            document.getElementById('kpi-footer-ultimo').textContent = `M² pintados en ${formatPeriodText(period)}`;
        }
        else if (kpi === 'pto-equilibrio') {
            title = "Punto de Equilibrio en M² (Real vs Teórico)";
            isCurrency = false;
            isArea = true;
            mediaVal = state.data.resumen['Pto Eq. ®'].media;
            ultimoVal = period === 'media' ? state.data.resumen['Pto Eq. ®'].media : (state.data.resumen['Pto Eq. ®'].valores[period] || 0);
            if (ultimoVal === 0 && period !== 'media') {
                const cf = state.data.resumen['CF ®'].valores[period] || 0;
                const cmg_m2 = state.data.resumen['CMg ® /m2'].valores[period] || 0;
                ultimoVal = cmg_m2 > 0 ? (cf / cmg_m2) : 0;
            }
            if (mediaVal === 0) {
                const cf = state.data.resumen['CF ®'].media;
                const cmg_m2 = state.data.resumen['CMg ® /m2'].media;
                mediaVal = cmg_m2 > 0 ? (cf / cmg_m2) : 0;
            }
            document.getElementById('kpi-footer-media').textContent = "Punto de equilibrio promedio para cubrir CF Reales";
            document.getElementById('kpi-footer-ultimo').textContent = `Punto de equilibrio estimado para ${formatPeriodText(period)}`;
        }
        else if (kpi === 'precio-m2') {
            title = "Precio de Venta Promedio por M²";
            mediaVal = state.data.resumen['Precio/m2'].media;
            ultimoVal = period === 'media' ? state.data.resumen['Precio/m2'].media : (state.data.resumen['Precio/m2'].valores[period] || 0);
            document.getElementById('kpi-footer-media').textContent = "Precio promedio facturado por M²";
            document.getElementById('kpi-footer-ultimo').textContent = `Precio promedio de ${formatPeriodText(period)}`;
        }
        else if (kpi === 'cv-m2') {
            title = "Costo Variable (CV) Unitario por M²";
            mediaVal = state.data.resumen['CV ® /m2'].media;
            ultimoVal = period === 'media' ? state.data.resumen['CV ® /m2'].media : (state.data.resumen['CV ® /m2'].valores[period] || 0);
            document.getElementById('kpi-footer-media').textContent = "CV Real unitario promedio";
            document.getElementById('kpi-footer-ultimo').textContent = `CV Real unitario de ${formatPeriodText(period)}`;
        }
        else if (kpi === 'cmg-m2') {
            title = "Contribución Marginal (CMg) Unitario por M²";
            mediaVal = state.data.resumen['CMg ® /m2'].media;
            ultimoVal = period === 'media' ? state.data.resumen['CMg ® /m2'].media : (state.data.resumen['CMg ® /m2'].valores[period] || 0);
            document.getElementById('kpi-footer-media').textContent = "CMg Real unitaria promedio";
            document.getElementById('kpi-footer-ultimo').textContent = `CMg Real unitaria de ${formatPeriodText(period)}`;
        }
        else if (kpi === 'cf-m2') {
            title = "Costo Fijo (CF) Unitario por M²";
            mediaVal = state.data.resumen['CF ® /m2'].media;
            ultimoVal = period === 'media' ? state.data.resumen['CF ® /m2'].media : (state.data.resumen['CF ® /m2'].valores[period] || 0);
            document.getElementById('kpi-footer-media').textContent = "CF Real unitario promedio";
            document.getElementById('kpi-footer-ultimo').textContent = `CF Real unitario de ${formatPeriodText(period)}`;
        }
        else if (kpi === 'rb-m2') {
            title = "Resultado Bruto (RB) Unitario por M²";
            mediaVal = state.data.resumen['RB ® /m2'].media;
            ultimoVal = period === 'media' ? state.data.resumen['RB ® /m2'].media : (state.data.resumen['RB ® /m2'].valores[period] || 0);
            document.getElementById('kpi-footer-media').textContent = "RB Real unitario promedio";
            document.getElementById('kpi-footer-ultimo').textContent = `RB Real unitario de ${formatPeriodText(period)}`;
        }
        else if (kpi === 'pareto-m2') {
            title = "Pareto de Clientes por M²";
            isCurrency = false;
            isArea = true;
            
            const getSum = (p) => {
                return state.data.clientes_m2.reduce((sum, c) => {
                    const val = p === 'media' ? c.media : (c.valores[p] || 0);
                    return sum + val;
                }, 0);
            };
            mediaVal = getSum('media');
            ultimoVal = getSum(period);
            
            document.getElementById('kpi-footer-media').textContent = "Suma total de M² pintados (Promedio mensual)";
            document.getElementById('kpi-footer-ultimo').textContent = `Suma total de M² pintados de ${formatPeriodText(period)}`;
        }
        else if (kpi === 'pareto-usd') {
            title = "Pareto de Clientes por Ingresos ($)";
            
            const getSum = (p) => {
                return state.data.clientes_usd.reduce((sum, c) => {
                    const val = p === 'media' ? c.media : (c.valores[p] || 0);
                    return sum + val;
                }, 0);
            };
            mediaVal = getSum('media');
            ultimoVal = getSum(period);
            
            document.getElementById('kpi-footer-media').textContent = "Suma total facturada en pesos (Promedio mensual)";
            document.getElementById('kpi-footer-ultimo').textContent = `Suma total facturada de ${formatPeriodText(period)}`;
        }
        
        const displayVal = (val) => {
            if (isCurrency) return formatCurrency(val);
            if (isArea) return formatM2(val);
            return val.toLocaleString('es-AR');
        };
        
        // Reestablecer contenido HTML / texto plano
        const mediaContainer = document.getElementById('kpi-val-media');
        const ultimoContainer = document.getElementById('kpi-val-ultimo');
        mediaContainer.innerHTML = '';
        ultimoContainer.innerHTML = '';
        mediaContainer.textContent = displayVal(mediaVal);
        ultimoContainer.textContent = displayVal(ultimoVal);
        
        document.getElementById('metric-details-title').textContent = title;
    }
    // Caso 2: Selección múltiple de elementos individuales
    else {
        let titleParts = [];
        
        let mediaHTML = `<div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.95rem; font-weight: 500; width: 100%;">`;
        let selectedHTML = `<div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.95rem; font-weight: 500; width: 100%;">`;
        
        kpis.forEach(kpiKey => {
            const row = state.data.resumen[kpiKey];
            if (!row) return;
            
            const mediaVal = row.media;
            const selectedVal = period === 'media' ? row.media : (row.valores[period] || 0);
            
            const isArea = kpiKey === 'M2' || kpiKey === 'Pto Eq. ®' || kpiKey === 'Pto Eq. (Fx)';
            const isCurrency = !isArea && kpiKey !== 'M2';
            
            const formatVal = (v) => {
                if (isCurrency) return formatCurrency(v);
                if (isArea) return formatM2(v);
                return v.toLocaleString('es-AR');
            };
            
            let displayName = kpiKey;
            if (kpiKey === 'CV ®') displayName = 'CV';
            if (kpiKey === 'CF ®') displayName = 'CF';
            if (kpiKey === 'CMg ®') displayName = 'CMg';
            if (kpiKey === 'Precio/m2') displayName = 'P. Vta/u';
            if (kpiKey === 'CV ® /m2') displayName = 'CV/u';
            if (kpiKey === 'CF ® /m2') displayName = 'CF/u';
            if (kpiKey === 'CMg ® /m2') displayName = 'CMg/u';
            
            titleParts.push(displayName);
            
            mediaHTML += `
                <div style="display: flex; justify-content: space-between; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                    <span class="text-muted" style="text-align: left;">${displayName}:</span>
                    <span style="font-weight: 700; text-align: right; color: white;">${formatVal(mediaVal)}</span>
                </div>
            `;
            
            selectedHTML += `
                <div style="display: flex; justify-content: space-between; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                    <span class="text-muted" style="text-align: left;">${displayName}:</span>
                    <span style="font-weight: 700; text-align: right; color: var(--color-primary-light);">${formatVal(selectedVal)}</span>
                </div>
            `;
        });
        
        mediaHTML += `</div>`;
        selectedHTML += `</div>`;
        
        document.getElementById('kpi-footer-media').textContent = "Valores promedio históricos";
        document.getElementById('kpi-footer-ultimo').textContent = `Valores registrados para ${formatPeriodText(period)}`;
        
        // Inyectar HTML en las tarjetas
        const mediaContainer = document.getElementById('kpi-val-media');
        const ultimoContainer = document.getElementById('kpi-val-ultimo');
        
        mediaContainer.innerHTML = mediaHTML;
        ultimoContainer.innerHTML = selectedHTML;
        
        document.getElementById('metric-details-title').textContent = "Análisis de Elementos: " + titleParts.join(' vs ');
    }
    
    // Renderizar gráfico y tabla correspondientes
    renderKPICharts();
}

function renderKPICharts() {
    const kpis = state.selectedKPIs || ['er-r-vs-fx'];
    const chartDiv = document.getElementById('metric-main-chart');
    const tableDiv = document.getElementById('metric-table-container');
    
    chartDiv.innerHTML = '';
    tableDiv.innerHTML = '';
    
    const meses = state.data.meses;
    const ultimoMes = state.data.ultimo_mes;
    
    if (kpis.length === 1 && isReport(kpis[0])) {
        const kpi = kpis[0];
        
        // -------------------------------------------------------------
        // CASO: ESTADO DE RESULTADOS REAL VS TEORICO
        // -------------------------------------------------------------
        if (kpi === 'er-r-vs-fx') {
            const rbR = meses.map(m => state.data.resumen['R. Bruto ®'].valores[m] || 0);
            const rbFx = meses.map(m => state.data.resumen['R. Bruto (Fx)'].valores[m] || 0);
        
        const options = {
            chart: { type: 'bar', height: 350, foreColor: '#94a3b8', toolbar: { show: false } },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
            series: [
                { name: 'Resultado Bruto Real (R)', data: rbR },
                { name: 'Resultado Bruto Teórico (Fx)', data: rbFx }
            ],
            dataLabels: {
                enabled: true,
                formatter: val => formatCurrency(val),
                style: { fontSize: '10px', colors: ['#f1f5f9'] }
            },
            yaxis: {
                labels: {
                    formatter: val => formatCurrency(val)
                }
            },
            xaxis: { categories: meses.map(m => formatPeriodText(m)) },
            colors: ['#10b981', '#1627b1'],
            tooltip: { y: { formatter: val => formatCurrency(val) } }
        };
        
        if (state.charts.kpiChart) state.charts.kpiChart.destroy();
        state.charts.kpiChart = new ApexCharts(chartDiv, options);
        state.charts.kpiChart.render();
        
        // Crear tabla
        let tableHTML = `
            <table class="metric-table">
                <thead>
                    <tr>
                        <th>Mes</th>
                        <th class="text-right">Real (R)</th>
                        <th class="text-right">Teórico (Fx)</th>
                        <th class="text-right">Diferencia</th>
                        <th class="text-right">Desviación %</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Agregar fila de promedio
        const avgR = state.data.resumen['R. Bruto ®'].media;
        const avgFx = state.data.resumen['R. Bruto (Fx)'].media;
        const diffAvg = avgR - avgFx;
        const devAvg = avgFx !== 0 ? (diffAvg / avgFx) * 100 : 0;
        
        tableHTML += `
            <tr style="font-weight: 700; background: rgba(255,255,255,0.04);">
                <td>Promedio 12 Meses</td>
                <td class="text-right">${formatCurrency(avgR)}</td>
                <td class="text-right">${formatCurrency(avgFx)}</td>
                <td class="text-right ${diffAvg >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(diffAvg)}</td>
                <td class="text-right ${diffAvg >= 0 ? 'text-success' : 'text-danger'}">${devAvg.toFixed(1)}%</td>
            </tr>
        `;
        
        // Agregar filas mensuales ordenadas cronológicamente
        meses.forEach(m => {
            const valR = state.data.resumen['R. Bruto ®'].valores[m] || 0;
            const valFx = state.data.resumen['R. Bruto (Fx)'].valores[m] || 0;
            const diff = valR - valFx;
            const dev = valFx !== 0 ? (diff / valFx) * 100 : 0;
            
            tableHTML += `
                <tr>
                    <td>${formatPeriodText(m)}</td>
                    <td class="text-right">${formatCurrency(valR)}</td>
                    <td class="text-right">${formatCurrency(valFx)}</td>
                    <td class="text-right ${diff >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(diff)}</td>
                    <td class="text-right ${diff >= 0 ? 'text-success' : 'text-danger'}">${dev.toFixed(1)}%</td>
                </tr>
            `;
        });
        
        tableHTML += `</tbody></table>`;
        tableDiv.innerHTML = tableHTML;
    }
    
    // -------------------------------------------------------------
    // CASO: CV REAL VS TEORICO
    // -------------------------------------------------------------
    else if (kpi === 'cv-r-vs-fx') {
        const cvR = meses.map(m => state.data.resumen['CV ®'].valores[m] || 0);
        const cvFx = meses.map(m => state.data.resumen['CV (Fx)'].valores[m] || 0);
        
        const options = {
            chart: { type: 'bar', height: 350, foreColor: '#94a3b8', toolbar: { show: false } },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
            series: [
                { name: 'CV Real (R)', data: cvR },
                { name: 'CV Teórico (Fx)', data: cvFx }
            ],
            dataLabels: {
                enabled: true,
                formatter: val => formatCurrency(val),
                style: { fontSize: '10px', colors: ['#f1f5f9'] }
            },
            yaxis: {
                labels: {
                    formatter: val => formatCurrency(val)
                }
            },
            xaxis: { categories: meses.map(m => formatPeriodText(m)) },
            colors: ['#ef4444', '#f59e0b'],
            tooltip: { y: { formatter: val => formatCurrency(val) } }
        };
        
        if (state.charts.kpiChart) state.charts.kpiChart.destroy();
        state.charts.kpiChart = new ApexCharts(chartDiv, options);
        state.charts.kpiChart.render();
        
        let tableHTML = `
            <table class="metric-table">
                <thead>
                    <tr>
                        <th>Mes</th>
                        <th class="text-right">CV Real (R)</th>
                        <th class="text-right">CV Teórico (Fx)</th>
                        <th class="text-right">Desviación (R vs Fx)</th>
                        <th class="text-right">% Desviación</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        const avgR = state.data.resumen['CV ®'].media;
        const avgFx = state.data.resumen['CV (Fx)'].media;
        const diffAvg = avgR - avgFx;
        const devAvg = avgFx !== 0 ? (diffAvg / avgFx) * 100 : 0;
        
        tableHTML += `
            <tr style="font-weight: 700; background: rgba(255,255,255,0.04);">
                <td>Promedio 12 Meses</td>
                <td class="text-right">${formatCurrency(avgR)}</td>
                <td class="text-right">${formatCurrency(avgFx)}</td>
                <td class="text-right ${diffAvg <= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(diffAvg)}</td>
                <td class="text-right ${diffAvg <= 0 ? 'text-success' : 'text-danger'}">${diffAvg >= 0 ? '+' : ''}${devAvg.toFixed(1)}%</td>
            </tr>
        `;
        
        meses.forEach(m => {
            const valR = state.data.resumen['CV ®'].valores[m] || 0;
            const valFx = state.data.resumen['CV (Fx)'].valores[m] || 0;
            const diff = valR - valFx;
            const dev = valFx !== 0 ? (diff / valFx) * 100 : 0;
            
            tableHTML += `
                <tr>
                    <td>${formatPeriodText(m)}</td>
                    <td class="text-right">${formatCurrency(valR)}</td>
                    <td class="text-right">${formatCurrency(valFx)}</td>
                    <td class="text-right ${diff <= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(diff)}</td>
                    <td class="text-right ${diff <= 0 ? 'text-success' : 'text-danger'}">${diff >= 0 ? '+' : ''}${dev.toFixed(1)}%</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        tableDiv.innerHTML = tableHTML;
    }
    
    // -------------------------------------------------------------
    // CASO: CF REAL VS TEORICO
    // -------------------------------------------------------------
    else if (kpi === 'cf-r-vs-fx') {
        const cfR = meses.map(m => state.data.resumen['CF ®'].valores[m] || 0);
        const cfFx = meses.map(m => state.data.resumen['CF (Fx)'].valores[m] || 0);
        
        const options = {
            chart: { type: 'bar', height: 350, foreColor: '#94a3b8', toolbar: { show: false } },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
            series: [
                { name: 'CF Real (R)', data: cfR },
                { name: 'CF Teórico (Fx)', data: cfFx }
            ],
            dataLabels: {
                enabled: true,
                formatter: val => formatCurrency(val),
                style: { fontSize: '10px', colors: ['#f1f5f9'] }
            },
            yaxis: {
                labels: {
                    formatter: val => formatCurrency(val)
                }
            },
            xaxis: { categories: meses.map(m => formatPeriodText(m)) },
            colors: ['#ef4444', '#f59e0b'],
            tooltip: { y: { formatter: val => formatCurrency(val) } }
        };
        
        if (state.charts.kpiChart) state.charts.kpiChart.destroy();
        state.charts.kpiChart = new ApexCharts(chartDiv, options);
        state.charts.kpiChart.render();
        
        let tableHTML = `
            <table class="metric-table">
                <thead>
                    <tr>
                        <th>Mes</th>
                        <th class="text-right">CF Real (R)</th>
                        <th class="text-right">CF Teórico (Fx)</th>
                        <th class="text-right">Diferencia</th>
                        <th class="text-right">% Desviación</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        const avgR = state.data.resumen['CF ®'].media;
        const avgFx = state.data.resumen['CF (Fx)'].media;
        const diffAvg = avgR - avgFx;
        const devAvg = avgFx !== 0 ? (diffAvg / avgFx) * 100 : 0;
        
        tableHTML += `
            <tr style="font-weight: 700; background: rgba(255,255,255,0.04);">
                <td>Promedio 12 Meses</td>
                <td class="text-right">${formatCurrency(avgR)}</td>
                <td class="text-right">${formatCurrency(avgFx)}</td>
                <td class="text-right ${diffAvg <= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(diffAvg)}</td>
                <td class="text-right ${diffAvg <= 0 ? 'text-success' : 'text-danger'}">${diffAvg >= 0 ? '+' : ''}${devAvg.toFixed(1)}%</td>
            </tr>
        `;
        
        meses.forEach(m => {
            const valR = state.data.resumen['CF ®'].valores[m] || 0;
            const valFx = state.data.resumen['CF (Fx)'].valores[m] || 0;
            const diff = valR - valFx;
            const dev = valFx !== 0 ? (diff / valFx) * 100 : 0;
            
            tableHTML += `
                <tr>
                    <td>${formatPeriodText(m)}</td>
                    <td class="text-right">${formatCurrency(valR)}</td>
                    <td class="text-right">${formatCurrency(valFx)}</td>
                    <td class="text-right ${diff <= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(diff)}</td>
                    <td class="text-right ${diff <= 0 ? 'text-success' : 'text-danger'}">${diff >= 0 ? '+' : ''}${dev.toFixed(1)}%</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        tableDiv.innerHTML = tableHTML;
    }
    
    // -------------------------------------------------------------
    // CASO: METROS CUADRADOS PINTADOS
    // -------------------------------------------------------------
    else if (kpi === 'm2-pintados') {
        const m2 = meses.map(m => state.data.resumen['M2'].valores[m] || 0);
        
        const options = {
            chart: { type: 'area', height: 350, foreColor: '#94a3b8', toolbar: { show: false } },
            stroke: { curve: 'smooth', width: 3 },
            fill: {
                type: 'gradient',
                gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 }
            },
            series: [{ name: 'M² Pintados', data: m2 }],
            dataLabels: { enabled: false },
            yaxis: {
                labels: {
                    formatter: val => formatM2(val)
                }
            },
            xaxis: { categories: meses.map(m => formatPeriodText(m)) },
            colors: ['#3b82f6'],
            tooltip: { y: { formatter: val => formatM2(val) } }
        };
        
        if (state.charts.kpiChart) state.charts.kpiChart.destroy();
        state.charts.kpiChart = new ApexCharts(chartDiv, options);
        state.charts.kpiChart.render();
        
        let tableHTML = `
            <table class="metric-table">
                <thead>
                    <tr>
                        <th>Mes</th>
                        <th class="text-right">M² Pintados</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="font-weight: 700; background: rgba(255,255,255,0.04);">
                        <td>Promedio 12 Meses</td>
                        <td class="text-right">${formatM2(state.data.resumen['M2'].media)}</td>
                    </tr>
        `;
        meses.forEach(m => {
            const val = state.data.resumen['M2'].valores[m] || 0;
            tableHTML += `
                <tr>
                    <td>${formatPeriodText(m)}</td>
                    <td class="text-right">${formatM2(val)}</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        tableDiv.innerHTML = tableHTML;
    }
    
    // -------------------------------------------------------------
    // CASO: PUNTO DE EQUILIBRIO EN M2
    // -------------------------------------------------------------
    else if (kpi === 'pto-equilibrio') {
        const peR = [];
        const peFx = [];
        
        meses.forEach(m => {
            // Obtener Pto de Equilibrio. Si es 0 en el Excel, lo calculamos en caliente
            let valR = state.data.resumen['Pto Eq. ®'].valores[m] || 0;
            let valFx = state.data.resumen['Pto Eq. (Fx)'].valores[m] || 0;
            
            if (valR === 0) {
                const cf = state.data.resumen['CF ®'].valores[m] || 0;
                const cmg_m2 = state.data.resumen['CMg ® /m2'].valores[m] || 0;
                valR = cmg_m2 > 0 ? (cf / cmg_m2) : 0;
            }
            if (valFx === 0) {
                const cf = state.data.resumen['CF (Fx)'].valores[m] || 0;
                const cmg_m2 = state.data.resumen['CMg (Fx) /m2'].valores[m] || 0;
                valFx = cmg_m2 > 0 ? (cf / cmg_m2) : 0;
            }
            
            peR.push(valR);
            peFx.push(valFx);
        });
        
        const options = {
            chart: { type: 'line', height: 350, foreColor: '#94a3b8', toolbar: { show: false } },
            stroke: { curve: 'straight', width: 3 },
            series: [
                { name: 'Punto de Equilibrio Real (R)', data: peR },
                { name: 'Punto de Equilibrio Teórico (Fx)', data: peFx }
            ],
            dataLabels: { enabled: false },
            yaxis: {
                labels: {
                    formatter: val => formatM2(val)
                }
            },
            xaxis: { categories: meses.map(m => formatPeriodText(m)) },
            colors: ['#ef4444', '#1627b1'],
            tooltip: { y: { formatter: val => formatM2(val) } }
        };
        
        if (state.charts.kpiChart) state.charts.kpiChart.destroy();
        state.charts.kpiChart = new ApexCharts(chartDiv, options);
        state.charts.kpiChart.render();
        
        let tableHTML = `
            <table class="metric-table">
                <thead>
                    <tr>
                        <th>Mes</th>
                        <th class="text-right">Pto. Equilibrio Real (m²)</th>
                        <th class="text-right">Pto. Equilibrio Teórico (m²)</th>
                        <th class="text-right">Diferencia</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Promedios
        let avgR = state.data.resumen['Pto Eq. ®'].media;
        let avgFx = state.data.resumen['Pto Eq. (Fx)'].media;
        if (avgR === 0) {
            avgR = peR.reduce((a,b)=>a+b,0) / peR.length;
        }
        if (avgFx === 0) {
            avgFx = peFx.reduce((a,b)=>a+b,0) / peFx.length;
        }
        const diffAvg = avgR - avgFx;
        
        tableHTML += `
            <tr style="font-weight: 700; background: rgba(255,255,255,0.04);">
                <td>Promedio 12 Meses</td>
                <td class="text-right">${formatM2(avgR)}</td>
                <td class="text-right">${formatM2(avgFx)}</td>
                <td class="text-right ${diffAvg <= 0 ? 'text-success' : 'text-danger'}">${formatM2(diffAvg)}</td>
            </tr>
        `;
        
        meses.forEach((m, idx) => {
            const valR = peR[idx];
            const valFx = peFx[idx];
            const diff = valR - valFx;
            
            tableHTML += `
                <tr>
                    <td>${formatPeriodText(m)}</td>
                    <td class="text-right">${formatM2(valR)}</td>
                    <td class="text-right">${formatM2(valFx)}</td>
                    <td class="text-right ${diff <= 0 ? 'text-success' : 'text-danger'}">${formatM2(diff)}</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        tableDiv.innerHTML = tableHTML;
    }
    
    // -------------------------------------------------------------
    // CASO: PRECIO UNITARIO POR M2
    // -------------------------------------------------------------
    else if (kpi === 'precio-m2') {
        const precios = meses.map(m => state.data.resumen['Precio/m2'].valores[m] || 0);
        
        const options = {
            chart: { type: 'line', height: 350, foreColor: '#94a3b8', toolbar: { show: false } },
            stroke: { curve: 'smooth', width: 3 },
            series: [{ name: 'Precio/M²', data: precios }],
            dataLabels: { enabled: false },
            yaxis: {
                labels: {
                    formatter: val => formatCurrency(val)
                }
            },
            xaxis: { categories: meses.map(m => formatPeriodText(m)) },
            colors: ['#10b981'],
            tooltip: { y: { formatter: val => formatCurrency(val) } }
        };
        
        if (state.charts.kpiChart) state.charts.kpiChart.destroy();
        state.charts.kpiChart = new ApexCharts(chartDiv, options);
        state.charts.kpiChart.render();
        
        let tableHTML = `
            <table class="metric-table">
                <thead>
                    <tr>
                        <th>Mes</th>
                        <th class="text-right">Precio Promedio por M²</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="font-weight: 700; background: rgba(255,255,255,0.04);">
                        <td>Promedio 12 Meses</td>
                        <td class="text-right">${formatCurrency(state.data.resumen['Precio/m2'].media)}</td>
                    </tr>
        `;
        meses.forEach(m => {
            const val = state.data.resumen['Precio/m2'].valores[m] || 0;
            tableHTML += `
                <tr>
                    <td>${formatPeriodText(m)}</td>
                    <td class="text-right">${formatCurrency(val)}</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        tableDiv.innerHTML = tableHTML;
    }
    
    // -------------------------------------------------------------
    // CASO: RATIOS POR M2 (CV, CMg, CF, RB)
    // -------------------------------------------------------------
    else if (['cv-m2', 'cmg-m2', 'cf-m2', 'rb-m2'].includes(kpi)) {
        let labelR = "", labelFx = "";
        let colorR = '#ef4444', colorFx = '#1627b1';
        
        if (kpi === 'cv-m2') {
            labelR = 'CV ® /m2'; labelFx = 'CV (Fx) /m2';
            colorR = '#ef4444'; colorFx = '#f59e0b';
        } else if (kpi === 'cmg-m2') {
            labelR = 'CMg ® /m2'; labelFx = 'CMg (Fx) /m2';
            colorR = '#10b981'; colorFx = '#3b82f6';
        } else if (kpi === 'cf-m2') {
            labelR = 'CF ® /m2'; labelFx = 'CF (Fx) /m2';
            colorR = '#ef4444'; colorFx = '#64748b';
        } else if (kpi === 'rb-m2') {
            labelR = 'RB ® /m2'; labelFx = 'RB (Fx) /m2';
            colorR = '#10b981'; colorFx = '#8b5cf6';
        }
        
        const valsR = meses.map(m => state.data.resumen[labelR].valores[m] || 0);
        const valsFx = meses.map(m => state.data.resumen[labelFx].valores[m] || 0);
        
        const options = {
            chart: { type: 'line', height: 350, foreColor: '#94a3b8', toolbar: { show: false } },
            stroke: { curve: 'smooth', width: 3 },
            series: [
                { name: `Real (${origenLabel(labelR)})`, data: valsR },
                { name: `Teórico (${origenLabel(labelFx)})`, data: valsFx }
            ],
            dataLabels: { enabled: false },
            yaxis: {
                labels: {
                    formatter: val => formatCurrency(val)
                }
            },
            xaxis: { categories: meses.map(m => formatPeriodText(m)) },
            colors: [colorR, colorFx],
            tooltip: { y: { formatter: val => formatCurrency(val) } }
        };
        
        if (state.charts.kpiChart) state.charts.kpiChart.destroy();
        state.charts.kpiChart = new ApexCharts(chartDiv, options);
        state.charts.kpiChart.render();
        
        let tableHTML = `
            <table class="metric-table">
                <thead>
                    <tr>
                        <th>Mes</th>
                        <th class="text-right">Real ($/m²)</th>
                        <th class="text-right">Teórico ($/m²)</th>
                        <th class="text-right">Diferencia</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        const avgR = state.data.resumen[labelR].media;
        const avgFx = state.data.resumen[labelFx].media;
        const diffAvg = avgR - avgFx;
        
        tableHTML += `
            <tr style="font-weight: 700; background: rgba(255,255,255,0.04);">
                <td>Promedio 12 Meses</td>
                <td class="text-right">${formatCurrency(avgR)}</td>
                <td class="text-right">${formatCurrency(avgFx)}</td>
                <td class="text-right">${formatCurrency(diffAvg)}</td>
            </tr>
        `;
        
        meses.forEach(m => {
            const valR = state.data.resumen[labelR].valores[m] || 0;
            const valFx = state.data.resumen[labelFx].valores[m] || 0;
            const diff = valR - valFx;
            
            tableHTML += `
                <tr>
                    <td>${formatPeriodText(m)}</td>
                    <td class="text-right">${formatCurrency(valR)}</td>
                    <td class="text-right">${formatCurrency(valFx)}</td>
                    <td class="text-right">${formatCurrency(diff)}</td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        tableDiv.innerHTML = tableHTML;
    }
    
    // -------------------------------------------------------------
    // CASO: PARETO DE CLIENTES (M2 Y VENTAS $)
    // -------------------------------------------------------------
    else if (kpi === 'pareto-m2' || kpi === 'pareto-usd') {
        const isM2 = kpi === 'pareto-m2';
        const period = state.selectedKPIPeriod || 'media';
        
        // Obtener clientes correspondientes
        const clientsSource = isM2 ? state.data.clientes_m2 : state.data.clientes_usd;
        
        // Extraer nombres y valores del periodo
        let clientList = clientsSource.map(c => {
            const val = period === 'media' ? c.media : (c.valores[period] || 0);
            return {
                nombre: c.nombre,
                valor: val
            };
        });
        
        // Filtrar clientes con valores nulos o menores a 0
        clientList = clientList.filter(c => c.valor > 0);
        
        // Ordenar descendentemente
        clientList.sort((a, b) => b.valor - a.valor);
        
        // Calcular suma total
        const totalSum = clientList.reduce((sum, c) => sum + c.valor, 0);
        
        // Calcular acumulado
        let cumulativeSum = 0;
        const chartCategories = [];
        const chartValues = [];
        const chartCumulativePct = [];
        
        const tableRows = clientList.map((c, index) => {
            cumulativeSum += c.valor;
            const pctIndividual = totalSum > 0 ? (c.valor / totalSum) * 100 : 0;
            const pctCumulative = totalSum > 0 ? (cumulativeSum / totalSum) * 100 : 0;
            
            // Guardar en arrays para el gráfico
            chartCategories.push(c.nombre);
            chartValues.push(Number(c.valor.toFixed(2)));
            chartCumulativePct.push(Number(pctCumulative.toFixed(1)));
            
            // El cliente pertenece al grupo del 80%?
            // Es menor a 80% o es el primer cliente que lo sobrepasa (el límite)
            const prevCumulative = pctCumulative - pctIndividual;
            const isTop80 = prevCumulative < 80;
            
            return {
                rank: index + 1,
                nombre: c.nombre,
                valor: c.valor,
                pctIndividual: pctIndividual,
                pctCumulative: pctCumulative,
                isTop80: isTop80
            };
        });
        
        // Generar Gráfico Mixto de Pareto (Columnas + Línea Acumulativa)
        const formatVal = (v) => isM2 ? formatM2(v) : formatCurrency(v);
        
        // Limitar gráfico a los primeros 12 clientes para evitar amontonamiento,
        // pero graficar la línea de Pareto completa
        const displayCategories = chartCategories.slice(0, 15);
        const displayValues = chartValues.slice(0, 15);
        const displayCumulative = chartCumulativePct.slice(0, 15);
        
        const options = {
            chart: {
                height: 380,
                type: 'line',
                foreColor: '#94a3b8',
                toolbar: { show: false }
            },
            stroke: {
                width: [0, 3],
                curve: 'smooth'
            },
            series: [{
                name: isM2 ? 'Metros Cuadrados (m²)' : 'Ingresos ($)',
                type: 'column',
                data: displayValues
            }, {
                name: '% Acumulado',
                type: 'line',
                data: displayCumulative
            }],
            colors: ['#1627b1', '#10b981'],
            xaxis: {
                categories: displayCategories,
                labels: {
                    rotate: -45,
                    style: { fontSize: '10px' }
                }
            },
            yaxis: [{
                title: { text: isM2 ? 'Metros Cuadrados (m²)' : 'Ingresos ($)' },
                labels: {
                    formatter: function(val) {
                        return isM2 ? formatM2(val) : formatCurrency(val);
                    }
                }
            }, {
                opposite: true,
                title: { text: '% Acumulado' },
                max: 100,
                min: 0,
                tickAmount: 5,
                labels: {
                    formatter: function(val) {
                        return val.toFixed(0) + '%';
                    }
                }
            }],
            tooltip: {
                shared: true,
                intersect: false,
                y: {
                    formatter: function (y, { seriesIndex }) {
                        if (typeof y !== "undefined") {
                            if (seriesIndex === 0) {
                                return formatVal(y);
                            }
                            return y.toFixed(1) + "%";
                        }
                        return y;
                    }
                }
            }
        };
        
        if (state.charts.kpiChart) state.charts.kpiChart.destroy();
        state.charts.kpiChart = new ApexCharts(chartDiv, options);
        state.charts.kpiChart.render();
        
        // Crear tabla de clientes
        let tableHTML = `
            <table class="metric-table">
                <thead>
                    <tr>
                        <th>N°</th>
                        <th>Cliente</th>
                        <th class="text-right">${isM2 ? 'M² Pintados' : 'Ventas ($)'}</th>
                        <th class="text-right">% Individual</th>
                        <th class="text-right">% Acumulado</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        tableRows.forEach(row => {
            const rowClass = row.isTop80 ? 'row-pareto-80' : '';
            tableHTML += `
                <tr class="${rowClass}">
                    <td>${row.rank}</td>
                    <td><strong>${row.nombre}</strong></td>
                    <td class="text-right">${formatVal(row.valor)}</td>
                    <td class="text-right">${row.pctIndividual.toFixed(1)}%</td>
                    <td class="text-right">${row.pctCumulative.toFixed(1)}%</td>
                </tr>
            `;
        });
        
        tableHTML += `
            <tr style="font-weight: 800; background: rgba(255,255,255,0.05); border-top: 1.5px solid var(--border-color);">
                <td>-</td>
                <td>TOTAL GENERAL</td>
                <td class="text-right">${formatVal(totalSum)}</td>
                <td class="text-right">100,0%</td>
                <td class="text-right">-</td>
            </tr>
        `;
        
        tableHTML += `</tbody></table>`;
        tableDiv.innerHTML = tableHTML;
    }
    } else {
        // Graficar múltiples series (Elementos)
        const seriesList = [];
        const colorsList = [];
        
        kpis.forEach(kpiKey => {
            const row = state.data.resumen[kpiKey];
            if (!row) return;
            
            let displayName = kpiKey;
            if (kpiKey === 'CV ®') displayName = 'CV';
            if (kpiKey === 'CF ®') displayName = 'CF';
            if (kpiKey === 'CMg ®') displayName = 'CMg';
            if (kpiKey === 'Precio/m2') displayName = 'P. Vta/u';
            if (kpiKey === 'CV ® /m2') displayName = 'CV/u';
            if (kpiKey === 'CF ® /m2') displayName = 'CF/u';
            if (kpiKey === 'CMg ® /m2') displayName = 'CMg/u';
            
            const dataVals = meses.map(m => row.valores[m] || 0);
            
            seriesList.push({
                name: displayName,
                data: dataVals
            });
            
            colorsList.push(COLOR_MAP[kpiKey] || '#1627b1');
        });
        
        // Determinar los grupos de unidades seleccionados
        const selectedGroups = new Set();
        kpis.forEach(kpiKey => {
            if (['Ingresos', 'CV ®', 'CF ®', 'CMg ®'].includes(kpiKey)) {
                selectedGroups.add('total_currency');
            } else if (kpiKey === 'M2') {
                selectedGroups.add('area');
            } else if (['Precio/m2', 'CV ® /m2', 'CF ® /m2', 'CMg ® /m2'].includes(kpiKey)) {
                selectedGroups.add('unit_currency');
            }
        });

        let yaxisConfig;
        if (selectedGroups.size <= 1) {
            let titleText = 'Monto ($)';
            let formatterFn = val => {
                if (val >= 1000000) {
                    return (val / 1000000).toFixed(1).replace('.', ',') + ' M';
                }
                return val.toLocaleString('es-AR', { maximumFractionDigits: 0 });
            };

            if (selectedGroups.has('area')) {
                titleText = 'Metros Cuadrados (m²)';
                formatterFn = val => formatM2(val);
            } else if (selectedGroups.has('unit_currency')) {
                titleText = 'Valores Unitarios ($/m²)';
                formatterFn = val => formatCurrency(val);
            }

            yaxisConfig = {
                title: { 
                    text: titleText,
                    style: { color: '#94a3b8', fontWeight: 600 }
                },
                labels: {
                    formatter: formatterFn,
                    style: { colors: '#94a3b8' }
                }
            };
        } else {
            let leftGroup;
            if (selectedGroups.has('total_currency')) {
                leftGroup = 'total_currency';
            } else if (selectedGroups.has('area')) {
                leftGroup = 'area';
            } else {
                leftGroup = 'unit_currency';
            }

            let firstLeftSeriesName = null;
            let firstRightSeriesName = null;

            const seriesInfo = kpis.map(kpiKey => {
                let displayName = kpiKey;
                if (kpiKey === 'CV ®') displayName = 'CV';
                if (kpiKey === 'CF ®') displayName = 'CF';
                if (kpiKey === 'CMg ®') displayName = 'CMg';
                if (kpiKey === 'Precio/m2') displayName = 'P. Vta/u';
                if (kpiKey === 'CV ® /m2') displayName = 'CV/u';
                if (kpiKey === 'CF ® /m2') displayName = 'CF/u';
                if (kpiKey === 'CMg ® /m2') displayName = 'CMg/u';

                let group;
                if (['Ingresos', 'CV ®', 'CF ®', 'CMg ®'].includes(kpiKey)) {
                    group = 'total_currency';
                } else if (kpiKey === 'M2') {
                    group = 'area';
                } else {
                    group = 'unit_currency';
                }

                const side = (group === leftGroup) ? 'left' : 'right';

                if (side === 'left' && !firstLeftSeriesName) {
                    firstLeftSeriesName = displayName;
                }
                if (side === 'right' && !firstRightSeriesName) {
                    firstRightSeriesName = displayName;
                }

                return { kpiKey, displayName, group, side };
            });

            yaxisConfig = seriesInfo.map(info => {
                const isLeft = (info.side === 'left');
                const isPrimary = (info.displayName === (isLeft ? firstLeftSeriesName : firstRightSeriesName));

                if (!isPrimary) {
                    return {
                        seriesName: isLeft ? firstLeftSeriesName : firstRightSeriesName,
                        opposite: !isLeft,
                        show: false
                    };
                }

                let titleText = '';
                let formatterFn;
                let axisColor = '#94a3b8';

                if (info.group === 'total_currency') {
                    titleText = 'Montos ($)';
                    axisColor = '#10b981';
                    formatterFn = val => {
                        if (val >= 1000000) {
                            return (val / 1000000).toFixed(1).replace('.', ',') + ' M';
                        }
                        return val.toLocaleString('es-AR', { maximumFractionDigits: 0 });
                    };
                } else if (info.group === 'area') {
                    titleText = 'Metros Cuadrados (m²)';
                    axisColor = '#3b82f6';
                    formatterFn = val => formatM2(val);
                } else {
                    titleText = 'Valores Unitarios ($/m²)';
                    axisColor = '#8b5cf6';
                    formatterFn = val => formatCurrency(val);
                }

                return {
                    seriesName: info.displayName,
                    opposite: !isLeft,
                    title: {
                        text: titleText,
                        style: { color: axisColor, fontWeight: 600 }
                    },
                    labels: {
                        formatter: formatterFn,
                        style: { colors: '#94a3b8' }
                    },
                    axisBorder: {
                        show: true,
                        color: axisColor
                    },
                    axisTicks: {
                        show: true
                    }
                };
            });
        }

        const options = {
            chart: {
                type: 'line',
                height: 350,
                foreColor: '#94a3b8',
                toolbar: { show: false }
            },
            stroke: {
                curve: 'smooth',
                width: 3
            },
            series: seriesList,
            xaxis: {
                categories: meses.map(m => formatPeriodText(m))
            },
            colors: colorsList,
            dataLabels: {
                enabled: kpis.length === 1,
                formatter: function(val, opts) {
                    const kpiKey = kpis[opts.seriesIndex];
                    const isArea = kpiKey === 'M2';
                    return isArea ? formatM2(val) : formatCurrency(val);
                },
                style: { fontSize: '10px', colors: ['#f1f5f9'] }
            },
            yaxis: yaxisConfig,
            tooltip: {
                shared: true,
                intersect: false,
                y: {
                    formatter: function (val, opts) {
                        if (val === undefined || val === null) return '-';
                        const kpiKey = kpis[opts.seriesIndex];
                        const isArea = kpiKey === 'M2';
                        return isArea ? formatM2(val) : formatCurrency(val);
                    }
                }
            }
        };
        
        if (state.charts.kpiChart) state.charts.kpiChart.destroy();
        state.charts.kpiChart = new ApexCharts(chartDiv, options);
        state.charts.kpiChart.render();
        
        // Crear tabla multi-columna
        let tableHTML = `
            <table class="metric-table">
                <thead>
                    <tr>
                        <th>Mes</th>
        `;
        
        kpis.forEach(kpiKey => {
            let displayName = kpiKey;
            if (kpiKey === 'CV ®') displayName = 'CV';
            if (kpiKey === 'CF ®') displayName = 'CF';
            if (kpiKey === 'CMg ®') displayName = 'CMg';
            if (kpiKey === 'Precio/m2') displayName = 'P. Vta/u';
            if (kpiKey === 'CV ® /m2') displayName = 'CV/u';
            if (kpiKey === 'CF ® /m2') displayName = 'CF/u';
            if (kpiKey === 'CMg ® /m2') displayName = 'CMg/u';
            
            tableHTML += `<th class="text-right">${displayName}</th>`;
        });
        
        tableHTML += `
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Fila de Promedio
        tableHTML += `
            <tr style="font-weight: 700; background: rgba(255,255,255,0.04);">
                <td>Promedio 12 Meses</td>
        `;
        
        kpis.forEach(kpiKey => {
            const row = state.data.resumen[kpiKey];
            const mediaVal = row ? row.media : 0;
            const isArea = kpiKey === 'M2';
            const valFormatted = isArea ? formatM2(mediaVal) : formatCurrency(mediaVal);
            tableHTML += `<td class="text-right">${valFormatted}</td>`;
        });
        
        tableHTML += `</tr>`;
        
        // Filas mensuales
        meses.forEach(m => {
            tableHTML += `
                <tr>
                    <td>${formatPeriodText(m)}</td>
            `;
            
            kpis.forEach(kpiKey => {
                const row = state.data.resumen[kpiKey];
                const val = row ? (row.valores[m] || 0) : 0;
                const isArea = kpiKey === 'M2';
                const valFormatted = isArea ? formatM2(val) : formatCurrency(val);
                tableHTML += `<td class="text-right">${valFormatted}</td>`;
            });
            
            tableHTML += `</tr>`;
        });
        
        tableHTML += `</tbody></table>`;
        tableDiv.innerHTML = tableHTML;
    }
}

// Helper para normalizar nombres en las leyendas de gráficos R vs Fx
function origenLabel(label) {
    if (label.includes('®')) return 'Real';
    if (label.includes('(Fx)')) return 'Teórico (Fx)';
    return label;
}

// Generación dinámica de iconos PNG a partir del SVG para dispositivos móviles (iOS/Android)
function generateDynamicIcons() {
    const img = new Image();
    img.src = 'logo.svg?v=1.0.4';
    img.onload = () => {
        // Dimensiones del SVG original
        const sWidth = img.naturalWidth || img.width || 145;
        const sHeight = img.naturalHeight || img.height || 95;

        // 1. Icono de 192x192 para Android / Chrome / Favicon
        const canvas192 = document.createElement('canvas');
        canvas192.width = 192;
        canvas192.height = 192;
        const ctx192 = canvas192.getContext('2d');
        
        // Rellenar con fondo oscuro premium (#0a0f1d)
        ctx192.fillStyle = '#0a0f1d';
        ctx192.fillRect(0, 0, 192, 192);
        
        // Calcular escala adaptativa del logo
        const maxDim192 = 192 * 0.75;
        let tw192, th192;
        if (sWidth / sHeight > 1) {
            tw192 = maxDim192;
            th192 = tw192 * (sHeight / sWidth);
        } else {
            th192 = maxDim192;
            tw192 = th192 * (sWidth / sHeight);
        }
        ctx192.drawImage(img, (192 - tw192) / 2, (192 - th192) / 2, tw192, th192);
        
        // Actualizar el href de <link rel="icon">
        const linkIcon = document.querySelector('link[rel="icon"]');
        if (linkIcon) {
            linkIcon.href = canvas192.toDataURL('image/png');
        }

        // 2. Icono de 180x180 para Apple Touch Icon (iOS Safari)
        const canvas180 = document.createElement('canvas');
        canvas180.width = 180;
        canvas180.height = 180;
        const ctx180 = canvas180.getContext('2d');
        
        ctx180.fillStyle = '#0a0f1d';
        ctx180.fillRect(0, 0, 180, 180);
        
        const maxDim180 = 180 * 0.75;
        let tw180, th180;
        if (sWidth / sHeight > 1) {
            tw180 = maxDim180;
            th180 = tw180 * (sHeight / sWidth);
        } else {
            th180 = maxDim180;
            tw180 = th180 * (sWidth / sHeight);
        }
        ctx180.drawImage(img, (180 - tw180) / 2, (180 - th180) / 2, tw180, th180);
        
        // Actualizar el href de <link rel="apple-touch-icon">
        const linkApple = document.querySelector('link[rel="apple-touch-icon"]');
        if (linkApple) {
            linkApple.href = canvas180.toDataURL('image/png');
        }
    };
}
