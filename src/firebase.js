// Configuración e inicialización de Firebase
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDAazQt0HKjCy0O-aRIBmNP3xlz7HHcroo",
  authDomain: "bn-demanda-estrategica.firebaseapp.com",
  databaseURL: "https://bn-demanda-estrategica-default-rtdb.firebaseio.com",
  projectId: "bn-demanda-estrategica",
  storageBucket: "bn-demanda-estrategica.firebasestorage.app",
  messagingSenderId: "424223476359",
  appId: "1:424223476359:web:1db44b43231412b6a40622"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Guarda los datos del portafolio principal en Realtime Database
export async function savePortafolioData(data) {
  await set(ref(db, 'dashboardData/portafolio'), {
    data: JSON.stringify(data),
    updatedAt: Date.now()
  });
}

// Guarda los datos de Demanda Estratégica (2) en Realtime Database
export async function saveDemanda2Data(data) {
  await set(ref(db, 'dashboardData/demanda2'), {
    data: JSON.stringify(data),
    updatedAt: Date.now()
  });
}

// Carga los datos del portafolio principal desde Realtime Database
export async function loadPortafolioData() {
  const snapshot = await get(ref(db, 'dashboardData/portafolio'));
  if (snapshot.exists()) {
    const val = snapshot.val();
    return JSON.parse(val.data);
  }
  return null;
}

// Carga los datos de Demanda Estratégica (2) desde Realtime Database
export async function loadDemanda2Data() {
  const snapshot = await get(ref(db, 'dashboardData/demanda2'));
  if (snapshot.exists()) {
    const val = snapshot.val();
    return JSON.parse(val.data);
  }
  return null;
}
