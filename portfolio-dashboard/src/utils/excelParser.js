import * as XLSX from 'xlsx';

// Función para limpiar texto y buscar columnas
const cleanString = (str) => {
  if (!str) return '';
  return String(str).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const findColumnIndex = (headers, possibleNames) => {
  for (let i = 0; i < headers.length; i++) {
    const headerStr = cleanString(headers[i]);
    if (possibleNames.some(name => headerStr.includes(cleanString(name)))) {
      return i;
    }
  }
  return -1;
};

// Conversión de fecha serial de Excel a JS Date
const excelSerialToDate = (serial) => {
  if (!serial || isNaN(serial) || typeof serial !== 'number' || serial < 25000 || serial > 60000) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  // Ajuste por zona horaria para evitar que caiga el día anterior
  date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
  return date;
};

const formatDate = (dateObj) => {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Limpieza de valores
const cleanValue = (val) => {
  if (val === undefined || val === null) return null;
  const strVal = String(val).trim();
  if (["#DIV/0!", "#VALUE!", "#REF!", "#N/A", "-", "No aplica", "No definido"].includes(strVal)) return null;
  return val;
};

const parsePercentage = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    return val <= 1 && val > -1 ? val * 100 : val;
  }
  const str = String(val).replace('%', '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const parseCurrency = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/S\/|s\/|\$|,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const parseExcelData = async (fileData) => {
  try {
    const workbook = XLSX.read(fileData, { type: 'array' });
    const sheetNames = workbook.SheetNames;
    
    console.log("Hojas detectadas:", sheetNames);

    const portafolioSheet = sheetNames.find(n => n.toLowerCase().includes('portafolio'));
    const demandaSheet = sheetNames.find(n => n.toLowerCase().includes('demanda'));
    const tendenciaSheet = sheetNames.find(n => n.toLowerCase().includes('transf') || n.toLowerCase().includes('tendencia'));
    const seguimientoSheet = sheetNames.find(n => n.toLowerCase().includes('seguimiento'));

    const parsedData = {
      portafolio: [],
      demanda: [],
      tendencia: [],
      seguimiento: []
    };

    // 1. Parse Portafolio P&D
    if (portafolioSheet) {
      const sheet = workbook.Sheets[portafolioSheet];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i] || [];
        if (row.some(cell => cleanString(cell) === 'n°' || cleanString(cell) === 'nombre del proyecto')) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx !== -1) {
        const headers = rows[headerRowIdx];
        const cols = {
          no: findColumnIndex(headers, ['n°', 'numero']),
          nombre: findColumnIndex(headers, ['nombre del proyecto', 'proyecto']),
          alcance: findColumnIndex(headers, ['alcance']),
          gerencia: findColumnIndex(headers, ['gerencia']),
          lider: findColumnIndex(headers, ['lider del proyecto']),
          presupuesto: findColumnIndex(headers, ['presupuesto']),
          dimension: findColumnIndex(headers, ['dimension']),
          anioInicio: findColumnIndex(headers, ['año inicio', 'ano inicio']),
          cambios: findColumnIndex(headers, ['solicitudes de cambio']),
          cartera: findColumnIndex(headers, ['cartera']),
          liderTecnico: findColumnIndex(headers, ['lider tecnico']),
          fechaInicio: findColumnIndex(headers, ['fecha inicio']),
          fechaFin: findColumnIndex(headers, ['fecha fin']),
          avancePlan: findColumnIndex(headers, ['avance planificado']),
          avanceEjec: findColumnIndex(headers, ['avance ejecutado']),
          desvio: findColumnIndex(headers, ['desv']),
          estado: findColumnIndex(headers, ['estado', 'estado proyecto ti']),
          seguimiento: findColumnIndex(headers, ['seguimiento'])
        };

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const nombre = cleanValue(row[cols.nombre]);
          if (!nombre) continue; // Solo filas con nombre válido

          parsedData.portafolio.push({
            no: cleanValue(row[cols.no]),
            nombre: nombre,
            alcance: cleanValue(row[cols.alcance]),
            gerencia: cleanValue(row[cols.gerencia]) || 'Sin Asignar',
            lider: cleanValue(row[cols.lider]),
            presupuesto: parseCurrency(row[cols.presupuesto]),
            dimension: cleanValue(row[cols.dimension]) || 'No Definida',
            cambios: parseInt(row[cols.cambios]) || 0,
            cartera: cleanValue(row[cols.cartera]) || 'Sin Cartera',
            anioInicio: cleanValue(row[cols.anioInicio]),
            liderTecnico: cleanValue(row[cols.liderTecnico]),
            fechaInicio: excelSerialToDate(row[cols.fechaInicio]),
            fechaFin: excelSerialToDate(row[cols.fechaFin]),
            avancePlan: parsePercentage(row[cols.avancePlan]),
            avanceEjec: parsePercentage(row[cols.avanceEjec]),
            desvio: parsePercentage(row[cols.desvio]),
            estado: cleanValue(row[cols.estado]) || '01. No Iniciado',
            seguimiento: cleanValue(row[cols.seguimiento])
          });
        }
      }
    }

    // 2. Parse Demanda Estrategica CT
    if (demandaSheet) {
      const sheet = workbook.Sheets[demandaSheet];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i] || [];
        if (row.some(cell => {
          const c = String(cell).toLowerCase().trim();
          return c === 'id' || c === 'tipo de requerimiento' || c === 'estado ti';
        })) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx !== -1) {
        const headers = rows[headerRowIdx];
        const cols = {
          id: findColumnIndex(headers, ['id']),
          tipo: findColumnIndex(headers, ['tipo de requerimiento']),
          nombre: findColumnIndex(headers, ['nombre del proyecto', 'proyecto']),
          gerencia: findColumnIndex(headers, ['gerencia lider']),
          presupuesto: findColumnIndex(headers, ['presupuesto']),
          cartera: findColumnIndex(headers, ['cartera']),
          estadoTI: findColumnIndex(headers, ['estado ti']),
          estadoProyTI: findColumnIndex(headers, ['estado proyecto ti']),
          avancePlan: findColumnIndex(headers, ['avance planificado']),
          avanceEjec: findColumnIndex(headers, ['avance ejecutado']),
          desvio: findColumnIndex(headers, ['desv']),
          diasFaltantes: findColumnIndex(headers, ['dias faltantes', 'faltantes']),
          alerta: findColumnIndex(headers, ['alerta']),
          trimestreFin: findColumnIndex(headers, ['trimestre']),
          liderTecnico: findColumnIndex(headers, ['lider tecnico', 'gestor ti']),
          proveedor: findColumnIndex(headers, ['entidad', 'proveedor']),
          notas: findColumnIndex(headers, ['seguimiento opp', 'seguimiento'])
        };

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const id = row[cols.id];
          if (!id || isNaN(parseInt(id))) continue; // ID numérico obligatorio

          parsedData.demanda.push({
            id: parseInt(id),
            tipo: cleanValue(row[cols.tipo]) || 'Proyecto',
            nombre: cleanValue(row[cols.nombre]),
            gerencia: cleanValue(row[cols.gerencia]) || 'Sin Asignar',
            presupuesto: parseCurrency(row[cols.presupuesto]),
            cartera: cleanValue(row[cols.cartera]) || 'Sin Cartera',
            estadoTI: cleanValue(row[cols.estadoTI]) || '01. Registrado',
            estadoProyTI: cleanValue(row[cols.estadoProyTI]) || '01. No Iniciado',
            avancePlan: parsePercentage(row[cols.avancePlan]),
            avanceEjec: parsePercentage(row[cols.avanceEjec]),
            desvio: parsePercentage(row[cols.desvio]),
            diasFaltantes: parseFloat(row[cols.diasFaltantes]) || 0,
            alerta: cleanValue(row[cols.alerta]),
            trimestreFin: cleanValue(row[cols.trimestreFin]),
            liderTecnico: cleanValue(row[cols.liderTecnico]),
            proveedor: cleanValue(row[cols.proveedor]),
            notas: cleanValue(row[cols.notas])
          });
        }
      }
    }

    // 3. Parse Tendencias (Pys Transf Digital)
    if (tendenciaSheet) {
      const sheet = workbook.Sheets[tendenciaSheet];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i] || [];
        if (row.some(cell => cleanString(cell) === 'proyectos priorizados' || cleanString(cell) === 'n°')) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx !== -1) {
        // En esta hoja, los meses suelen estar en la fila superior (headerRowIdx - 1) 
        // o en el mismo headerRowIdx con celdas mergeadas.
        // Vamos a escanear los encabezados en headerRowIdx y la fila inmediatamente arriba.
        const headerRow = rows[headerRowIdx];
        const topRow = headerRowIdx > 0 ? rows[headerRowIdx - 1] : headerRow;
        
        // Identificar columnas fijas
        const cols = {
          nombre: findColumnIndex(headerRow, ['proyectos priorizados', 'nombre']),
          estado: findColumnIndex(headerRow, ['estado']),
          gerencia: findColumnIndex(headerRow, ['gerencia']),
          presupuesto: findColumnIndex(headerRow, ['presupuesto']),
        };

        // Identificar columnas de meses buscando strings como "ENE", "FEB"
        const monthCols = []; // { mes: "ENE 2024", planifIdx, ejecIdx }
        let currentMonth = null;
        let currentPlanifIdx = -1;
        
        const monthRegex = /(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic).*20\d{2}/i;
        
        for (let j = 0; j < Math.max(topRow.length, headerRow.length); j++) {
          const topVal = topRow[j] ? String(topRow[j]).trim() : '';
          const headerVal = headerRow[j] ? String(headerRow[j]).trim() : '';
          
          let monthNameMatch = topVal.match(monthRegex) || headerVal.match(monthRegex);
          if (monthNameMatch) {
            // Si es un nuevo mes, o el mismo mes pero es Planif
            const mName = monthNameMatch[0].toUpperCase();
            if (!currentMonth || currentMonth !== mName) {
              if (currentMonth && currentPlanifIdx !== -1) {
                monthCols.push({ mes: currentMonth, planifIdx: currentPlanifIdx, ejecIdx: j - 1 }); // Asumiendo ejecIdx fue el anterior si no lo encontramos
              }
              currentMonth = mName;
              currentPlanifIdx = j;
            } else if (currentMonth === mName && currentPlanifIdx !== -1) {
              // El segundo encuentro es el ejecutado
              monthCols.push({ mes: currentMonth, planifIdx: currentPlanifIdx, ejecIdx: j });
              currentMonth = null;
              currentPlanifIdx = -1;
            }
          }
        }
        if (currentMonth && currentPlanifIdx !== -1) {
             monthCols.push({ mes: currentMonth, planifIdx: currentPlanifIdx, ejecIdx: currentPlanifIdx + 1 });
        }

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const nombre = cleanValue(row[cols.nombre]);
          if (!nombre) continue;

          const meses = [];
          for (const m of monthCols) {
            const planifRaw = row[m.planifIdx];
            const ejecRaw = row[m.ejecIdx];
            
            // Si ambos son vacíos o guiones, ignorar este mes para este proyecto
            if ((!planifRaw || planifRaw === '-') && (!ejecRaw || ejecRaw === '-')) continue;

            meses.push({
              mes: m.mes,
              planif: parsePercentage(planifRaw),
              ejec: parsePercentage(ejecRaw)
            });
          }

          if (meses.length > 0) {
            parsedData.tendencia.push({
              nombre: nombre,
              estado: cleanValue(row[cols.estado]),
              gerencia: cleanValue(row[cols.gerencia]),
              presupuesto: parseCurrency(row[cols.presupuesto]),
              meses: meses
            });
          }
        }
      }
    }

    // 4. Parse Seguimiento Semanal
    if (seguimientoSheet) {
      const sheet = workbook.Sheets[seguimientoSheet];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i] || [];
        if (row.some(cell => cleanString(cell) === 'proyecto' || cleanString(cell) === 'pendientes')) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx !== -1) {
        const headers = rows[headerRowIdx];
        const cols = {
          proyecto: findColumnIndex(headers, ['proyecto']),
          pendientes: findColumnIndex(headers, ['pendientes']),
          responsable: findColumnIndex(headers, ['responsable']),
          fechaCompromiso2: findColumnIndex(headers, ['fecha compromiso2', 'fecha compromiso 2']),
          apoyo: findColumnIndex(headers, ['apoyo bn']),
          proveedor: findColumnIndex(headers, ['proveedor']),
          estado: findColumnIndex(headers, ['estado'])
        };

        // Fallback si no encuentra 'fecha compromiso2'
        if (cols.fechaCompromiso2 === -1) {
            cols.fechaCompromiso2 = findColumnIndex(headers, ['fecha compromiso']);
        }

        let currentProyecto = ''; // En caso de celdas combinadas

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          if (row[cols.proyecto]) currentProyecto = cleanValue(row[cols.proyecto]);
          const pendiente = cleanValue(row[cols.pendientes]);
          
          if (!pendiente && !currentProyecto) continue;

          let rawEstado = String(cleanValue(row[cols.estado]) || 'Pendiente').toLowerCase().trim();
          let estadoFormat = 'Por Definir';
          if (rawEstado.includes('proceso')) estadoFormat = 'En Proceso';
          else if (rawEstado.includes('finalizado') || rawEstado.includes('ok')) estadoFormat = 'Finalizado';
          else if (rawEstado.includes('pendiente')) estadoFormat = 'Pendiente';

          // Manejar fecha compromiso que a veces trae texto
          const rawDate = row[cols.fechaCompromiso2];
          let fechaObj = null;
          if (typeof rawDate === 'number') {
            fechaObj = excelSerialToDate(rawDate);
          } else if (typeof rawDate === 'string' && rawDate.includes('/')) {
             // Intento de parseo manual si viene como string
             const parts = rawDate.split('/');
             if(parts.length === 3) fechaObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
          }

          parsedData.seguimiento.push({
            id: i, // ID único para react keys
            proyecto: currentProyecto || 'General',
            pendiente: pendiente || 'Sin descripción',
            responsable: cleanValue(row[cols.responsable]) || 'Sin asignar',
            fechaRaw: fechaObj,
            fechaCompromisoStr: formatDate(fechaObj),
            apoyo: cleanValue(row[cols.apoyo]),
            proveedor: cleanValue(row[cols.proveedor]),
            estado: estadoFormat
          });
        }
      }
    }

    return parsedData;

  } catch (error) {
    console.error("Error al procesar el Excel:", error);
    throw new Error("El archivo no tiene el formato esperado o está dañado.");
  }
};
