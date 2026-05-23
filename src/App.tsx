import React, { useState, useEffect, useCallback } from 'react';
import mqtt from 'mqtt';
import { Power, Settings2, Droplets, Thermometer, Radio, Wifi, WifiOff, Zap, Lightbulb, Activity } from 'lucide-react';
import { SensorData, RelayStatus } from './types';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

export default function App() {
  const [deviceId, setDeviceId] = useState('XX');
  const [connected, setConnected] = useState(false);
  const [client, setClient] = useState<mqtt.MqttClient | null>(null);

  const [sensorData, setSensorData] = useState<SensorData>({ suhu: 0, kelembaban: 0 });
  const [relayStatus, setRelayStatus] = useState<RelayStatus>({ r1: 0, r2: 0, r3: 0, r4: 0, v1: 0, v2: 0 });
  const [logs, setLogs] = useState<{id: string, text: string}[]>([]);

  const addLog = useCallback((text: string) => {
    setLogs(prev => {
      const newLog = { id: Math.random().toString(36).substr(2, 9), text };
      return [newLog, ...prev].slice(0, 6);
    });
  }, []);

  // Handle MQTT Connection
  useEffect(() => {
    // Connect to EMQX Public Broker via WebSocket
    const mqttClient = mqtt.connect(BROKER_URL, {
      clientId: `web-client-${Math.random().toString(16).substring(2, 8)}`,
      keepalive: 30,
    });

    mqttClient.on('connect', () => {
      setConnected(true);
      addLog(`Connected to ${BROKER_URL}`);
      // Subscribe to topics using current deviceId
      mqttClient.subscribe(`smartlight/${deviceId}/status`);
      mqttClient.subscribe(`smartlight/${deviceId}/sensor`);
      
      // Request initial status
      mqttClient.publish(`smartlight/${deviceId}/cmd`, 'get_status');
      mqttClient.publish(`smartlight/${deviceId}/cmd`, 'get_sensor');
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const payloadStr = message.toString();
        const payload = JSON.parse(payloadStr);

        if (topic === `smartlight/${deviceId}/status`) {
          setRelayStatus(payload);
          addLog(`> Received status update`);
        } else if (topic === `smartlight/${deviceId}/sensor`) {
          setSensorData(payload);
          addLog(`> Received sensor data`);
        }
      } catch (err) {
        console.error('Failed to parse MQTT message:', err);
      }
    });

    mqttClient.on('close', () => setConnected(false));
    mqttClient.on('error', () => setConnected(false));

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
    // Re-run effect when deviceId changes (in a real app we might just resubscribe, but for simplicity we reconnect)
  }, [deviceId, addLog]);

  // Command Helper
  const sendCommand = useCallback((cmd: string) => {
    if (client && connected) {
      addLog(`> Sent cmd: ${cmd}`);
      client.publish(`smartlight/${deviceId}/cmd`, cmd);
    }
  }, [client, connected, deviceId, addLog]);

  return (
    <div className="relative min-h-screen w-full flex flex-col z-0">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] glow-bg-blue pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] glow-bg-pink pointer-events-none translate-x-1/3 translate-y-1/3"></div>

      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8 z-10 flex flex-col flex-grow relative pb-20">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-2 mt-4 z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 glass-card flex items-center justify-center relative group">
              <Zap className="w-7 h-7 text-cyan-400 relative z-10 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight uppercase">
                Neon <span className="neon-blue">Smartlight</span>
              </h1>
              <p className="text-xs text-gray-400 font-mono mt-1">MQTT: {BROKER_URL.split('://')[1].split(':')[0]} | IoT Dashboard</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
             {/* Device Config */}
             <div className="glass-card px-5 py-3 flex items-center gap-3">
              <Settings2 className="w-4 h-4 text-gray-400" />
               <div className="flex flex-col items-start">
                 <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Device ID</span>
                 <input 
                   type="text" 
                   value={deviceId}
                   onChange={(e) => setDeviceId(e.target.value)}
                   placeholder="XX"
                   className="bg-transparent border-none outline-none text-sm w-16 font-mono text-cyan-400 placeholder:text-gray-600 uppercase font-bold"
                 />
               </div>
            </div>

            <div className="glass-card px-5 py-3 flex flex-col items-end">
              <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">MQTT Status</span>
              <span className={`text-sm font-mono uppercase font-bold flex items-center gap-2 ${connected ? 'text-green-400' : 'text-red-400'}`}>
                {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {connected ? 'CONNECTED' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-grow">
          
          {/* SENSOR PANEL */}
          <div className="md:col-span-4 flex flex-col gap-6">
            <div className="glass-card flex-1 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
              <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2 z-10">
                <Thermometer className="w-4 h-4 text-cyan-400"/> Environment Temp
              </span>
              <div className="flex items-baseline gap-2 z-10">
                <span className="text-6xl lg:text-7xl font-light neon-blue tracking-tighter">{sensorData.suhu.toFixed(1)}</span>
                <span className="text-2xl text-gray-500">°C</span>
              </div>
              <div className="mt-8 h-1 w-full bg-white/10 rounded-full z-10 overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, Math.max(0, (sensorData.suhu / 50) * 100))}%` }}></div>
              </div>
            </div>

            <div className="glass-card flex-1 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden group hover:border-pink-500/50 transition-colors">
              <div className="absolute inset-0 bg-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2 z-10">
                <Droplets className="w-4 h-4 text-pink-500"/> Air Humidity
              </span>
              <div className="flex items-baseline gap-2 z-10">
                <span className="text-6xl lg:text-7xl font-light neon-pink tracking-tighter">{sensorData.kelembaban.toFixed(1)}</span>
                <span className="text-2xl text-gray-500">%</span>
              </div>
              <div className="mt-8 h-1 w-full bg-white/10 rounded-full z-10 overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, Math.max(0, sensorData.kelembaban))}%` }}></div>
              </div>
            </div>
          </div>

          {/* CONTROLS PANEL */}
          <div className="md:col-span-8 flex flex-col gap-6">
            
            <div className="glass-card p-6 md:p-8 flex flex-col min-h-[300px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-cyan-400" />
                  Manual Relay Controls
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => sendCommand('all_on')}
                    className="text-[10px] uppercase tracking-widest font-bold px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/5 hover:border-white/20"
                  >
                    Set All On
                  </button>
                  <button 
                    onClick={() => sendCommand('all_off')}
                    className="text-[10px] uppercase tracking-widest font-bold px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-gray-400 border border-transparent"
                  >
                    Set All Off
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-grow">
                {[1, 2, 3, 4].map((num) => {
                  const rKey = `r${num}` as keyof RelayStatus;
                  const isOn = relayStatus[rKey] === 1;
                  const isPink = num % 2 === 0;
                  const activeColor = isPink ? 'bg-pink-500 shadow-[0_0_8px_pink]' : 'bg-cyan-500 shadow-[0_0_8px_cyan]';
                  const buttonClass = isOn 
                    ? (isPink ? 'active-toggle-pink text-white' : 'active-toggle-blue text-white')
                    : 'bg-white/5 border border-white/10 text-gray-500 hover:bg-white/10';

                  return (
                    <div key={`relay-${num}`} className={`glass-card p-5 flex flex-col justify-between transition-colors ${isOn ? 'bg-white/5 border-white/20' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-300">Relay 0{num}</div>
                        <div className={`w-2 h-2 rounded-full transition-all ${isOn ? activeColor : 'bg-gray-700'}`}></div>
                      </div>
                      <div className="mt-6 mb-6">
                        <div className="text-xl font-bold mb-1">Light {num}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">GPIO Pin</div>
                      </div>
                      <button
                        onClick={() => sendCommand(`r${num}_${isOn ? 'off' : 'on'}`)}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${buttonClass}`}
                      >
                        {isOn ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-card p-6 md:p-8 flex flex-col">
               <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                <Zap className="w-4 h-4 text-pink-500" />
                Lighting Patterns
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <button
                    onClick={() => sendCommand('v1_on')}
                    className="py-5 glass-card bg-white/5 text-left px-5 flex items-center justify-between group hover:bg-white/10 transition-all border border-transparent hover:border-cyan-500/30"
                 >
                    <div>
                      <div className={`text-sm font-bold tracking-wide ${relayStatus.v1 === 1 ? 'neon-blue' : ''}`}>DISCO MODE</div>
                      <div className="text-[10px] text-cyan-400 uppercase mt-1 tracking-widest font-mono">Pattern V1</div>
                    </div>
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${relayStatus.v1 === 1 ? 'border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.3)]' : 'border-white/20 text-white/30 group-hover:text-white'}`}>▶</div>
                 </button>

                 <button
                    onClick={() => sendCommand('v2_on')}
                    className="py-5 glass-card bg-white/5 text-left px-5 flex items-center justify-between group hover:bg-white/10 transition-all border border-transparent hover:border-pink-500/30"
                 >
                    <div>
                      <div className={`text-sm font-bold tracking-wide ${relayStatus.v2 === 1 ? 'neon-pink' : ''}`}>STEP MODE</div>
                      <div className="text-[10px] text-pink-400 uppercase mt-1 tracking-widest font-mono">Pattern V2</div>
                    </div>
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${relayStatus.v2 === 1 ? 'border-pink-400 text-pink-400 shadow-[0_0_10px_rgba(255,0,229,0.3)]' : 'border-white/20 text-white/30 group-hover:text-white'}`}>▶</div>
                 </button>

                 <button
                    onClick={() => sendCommand('v_stop')}
                    className="py-5 bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold uppercase tracking-widest rounded-3xl hover:bg-red-500/20 hover:border-red-500/40 transition-all flex items-center justify-center"
                 >
                    Stop Patterns
                 </button>
              </div>
            </div>

            {/* LIVE ACTIVITY PANEL */}
            <div className="glass-card p-6 md:p-8 flex flex-col mt-6">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live Activity
              </h3>
              <div className="font-mono text-[10px] text-cyan-200/60 space-y-2 h-32 overflow-hidden flex flex-col justify-end">
                {logs.slice().reverse().map(log => (
                  <p key={log.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">{log.text}</p>
                ))}
                {logs.length === 0 && <p className="opacity-50 italic">Awaiting events...</p>}
              </div>
            </div>

          </div>
        </div>

        {/* Footer Bar */}
        <footer className="mt-4 flex flex-col sm:flex-row justify-between items-center text-[10px] text-gray-500 font-mono uppercase tracking-widest gap-2 bg-black/20 p-4 rounded-2xl glass-card border-none">
          <div>Topic Sub: smartlight/{deviceId || 'XX'}/cmd</div>
          <div className="flex gap-6">
             <span className={connected ? 'text-cyan-400' : 'text-red-400'}>
               {connected ? 'Connection: Secure WebSocket' : 'Connection: Disconnected'}
             </span>
          </div>
        </footer>

      </div>
    </div>
  );
}
