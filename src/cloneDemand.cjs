const fs = require('fs');

const content = fs.readFileSync('App.jsx', 'utf8');

const demandStart = content.indexOf('const renderDemandDashboard = () => {');
const portStart = content.indexOf('const renderPortfolioDashboard = () => {');

let demandCode = content.substring(demandStart, portStart);

let demand2Code = demandCode.replace('const renderDemandDashboard = () => {', 'const renderDemand2Dashboard = () => {');
demand2Code = demand2Code.replace(/filteredDemand/g, 'filteredDemand2');
demand2Code = demand2Code.replace(/data\?\.demand/g, 'demand2Data');
demand2Code = demand2Code.replace(/data\.demand/g, 'demand2Data');
demand2Code = demand2Code.replace(/Demanda Estratégica TI/g, 'Demanda Estratégica (2)');

const newContent = content.slice(0, portStart) + demand2Code + '\n' + content.slice(portStart);

fs.writeFileSync('App.jsx', newContent);
console.log('Successfully cloned demand dashboard');
