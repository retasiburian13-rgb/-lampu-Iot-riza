import React, { useState, useEffect, useCallback, useRef } from 'react';
import mqtt from 'mqtt';
import { Power, Settings2, Droplets, Thermometer, Radio, Wifi, WifiOff, Zap, Lightbulb, Activity, RotateCw } from 'lucide-react';
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
      return [newLog, ...prev].slice(0, 8);
    });
  }, []);

  // Handle MQTT Broker Connection (Only connect once)
  useEffect(() => {
    let isMounted = true;
    const mqttClient = mqtt.connect(BROKER_URL, {
      clientId: `web_${Math.random().toString(16).substring(2, 10)}`,
      keepalive: 60,
      clean: true,
      protocolVersion: 4, 
      reconnectPeriod: 3000,
    });

    mqttClient.on('connect', () => {
      if (!isMounted) return;
      setConnected(true);
      addLog(`Connected to MQTT broker`);
      setClient(mqttClient);
    });

    mqttClient.on('close', () => {
      if (isMounted) setConnected(false);
    });
    
    mqttClient.on('error', (err) => {
      if (isMounted) {
        setConnected(false);
        if (err.message && err.message.includes('disconnecting')) return;
        console.warn("MQTT Error:", err.message);
      }
    });

    return () => {
      isMounted = false;
      mqttClient.end(true);
    };
  }, [addLog]);

  // Handle Topic Subscriptions when Device ID changes
  useEffect(() => {
    if (client && connected && deviceId.trim()) {
      const cleanId = deviceId.trim();
      
      const statusTopic = `smartlight/${cleanId}/status`;
      const sensorTopic = `smartlight/${cleanId}/sensor`;
      const cmdTopic = `smartlight/${cleanId}/cmd`;
      
      // Use QoS 0 for maximum compatibility with ESP32 PubSubClient
      client.subscribe(statusTopic, { qos: 0 });
      client.subscribe(sensorTopic, { qos: 0 });
      
      addLog(`Tracking Device: ${cleanId}`);

      // Setup message handler specific to this device
      const handleMessage = (topic: string, message: Buffer) => {
        try {
          const payloadStr = message.toString();
          
          if (topic === statusTopic) {
            const cleanStr = payloadStr.replace(/,\s*}/g, '}');
            setRelayStatus(JSON.parse(cleanStr));
            addLog(`> Status synced`);
          } else if (topic === sensorTopic) {
            const cleanStr = payloadStr.replace(/,\s*}/g, '}');
            setSensorData(JSON.parse(cleanStr));
          }
        } catch (err) {
          console.error('Failed to parse message:', message.toString());
        }
      };

      client.on('message', handleMessage);

      // Request initial status when subscribing
      client.publish(cmdTopic, 'get_status', { qos: 0 });
      client.publish(cmdTopic, 'get_sensor', { qos: 0 });

      return () => {
        client.off('message', handleMessage);
        client.unsubscribe(statusTopic);
        client.unsubscribe(sensorTopic);
      };
    }
  }, [client, connected, deviceId, addLog]);

  // Command Helper
  const sendCommand = useCallback((cmd: string) => {
    const cleanId = deviceId.trim();
    if (client && connected && cleanId) {
      const targetTopic = `smartlight/${cleanId}/cmd`;
      addLog(`Send: ${cmd}`);
      
      // Use QoS 0 to ensure ESP32 PubSubClient receives it properly without ACK mismatches
      client.publish(targetTopic, cmd, { qos: 0, retain: false }, (err) => {
        if (err) {
          console.error("Publish error:", err);
          addLog(`Err: ${err.message}`);
        }
      });
    } else if (!connected) {
      addLog(`Err: Not Connected`);
    } else if (!cleanId) {
      addLog(`Err: Missing Device ID`);
    }
  }, [client, connected, deviceId, addLog]);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-start z-0 overflow-x-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] glow-bg-blue pointer-events-none -translate-x-1/2 -translate-y-1/2 opacity-60"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] glow-bg-pink pointer-events-none translate-x-1/3 translate-y-1/3 opacity-60"></div>

      <div className="max-w-6xl w-full p-4 sm:p-6 lg:p-8 space-y-6 z-10 flex flex-col flex-grow relative pb-20">
        
        {/* CONNECTION & SETUP PANEL (Explicitly visible at top) */}
        <div className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-cyan-500/30 shadow-[0_0_25px_rgba(0,242,255,0.05)] w-full">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center relative ${connected ? 'bg-cyan-500/10 shadow-[0_0_15px_rgba(0,242,255,0.2)]' : 'bg-red-500/10 text-red-500'}`}>
               {connected ? <Zap className="w-7 h-7 text-cyan-400 animate-pulse" /> : <WifiOff className="w-7 h-7 text-red-500" />}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase">
                Neon <span className="neon-blue">Dashboard</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                 <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></span>
                 <span className="text-xs text-gray-400 font-mono tracking-widest uppercase">{connected ? 'Broker Online' : 'Broker Offline'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto p-4 rounded-2xl bg-black/40 border border-white/5">
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-[10px] uppercase text-gray-400 font-bold tracking-widest mb-1 ml-1 flex items-center gap-1">
                <Settings2 className="w-3 h-3"/> Target Device ID
              </label>
              <input 
                type="text" 
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                placeholder="e.g. XX"
                className="bg-white/5 border border-cyan-500/30 focus:border-cyan-400 focus:bg-cyan-950/20 rounded-xl px-4 py-3 outline-none text-xl w-full sm:w-48 font-mono text-cyan-400 placeholder:text-gray-600 font-bold tracking-widest uppercase transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]"
              />
            </div>
            <button 
              onClick={() => {
                sendCommand('get_status');
                sendCommand('get_sensor');
              }}
              className="w-full sm:w-auto self-end bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 p-3.5 rounded-xl transition-all flex justify-center items-center group shadow-[0_0_15px_rgba(0,242,255,0.1)] hover:shadow-[0_0_25px_rgba(0,242,255,0.3)]"
              title="Force Sync"
            >
               <RotateCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-grow items-start min-h-0">
          
          {/* SENSOR PANEL */}
          <div className="md:col-span-4 flex flex-col gap-6">
            <div className="glass-card flex-1 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
              <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2 z-10">
                <Thermometer className="w-4 h-4 text-cyan-400"/> Environment Temp
              </span>
              <div className="flex items-baseline gap-2 z-10">
                <span className="text-6xl font-light neon-blue tracking-tighter">{sensorData.suhu.toFixed(1)}</span>
                <span className="text-2xl text-gray-500">°C</span>
              </div>
              <div className="mt-8 h-1 w-full bg-white/10 rounded-full z-10 overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_#00f2ff]" style={{ width: `${Math.min(100, Math.max(0, (sensorData.suhu / 50) * 100))}%` }}></div>
              </div>
            </div>

            <div className="glass-card flex-1 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden group hover:border-pink-500/50 transition-colors">
              <div className="absolute inset-0 bg-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2 z-10">
                <Droplets className="w-4 h-4 text-pink-500"/> Air Humidity
              </span>
              <div className="flex items-baseline gap-2 z-10">
                <span className="text-6xl font-light neon-pink tracking-tighter">{sensorData.kelembaban.toFixed(1)}</span>
                <span className="text-2xl text-gray-500">%</span>
              </div>
              <div className="mt-8 h-1 w-full bg-white/10 rounded-full z-10 overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_#ff00e5]" style={{ width: `${Math.min(100, Math.max(0, sensorData.kelembaban))}%` }}></div>
              </div>
            </div>

            {/* LIVE ACTIVITY PANEL */}
            <div className="glass-card p-6 flex flex-col">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live Log
              </h3>
              <div className="font-mono text-[10px] text-cyan-200/60 space-y-2 h-40 overflow-y-auto flex flex-col justify-start">
                {logs.map(log => (
                  <p key={log.id} className="animate-in fade-in slide-in-from-left-2 duration-300 border-b border-white/5 pb-1">{log.text}</p>
                ))}
                {logs.length === 0 && <p className="opacity-50 italic">Awaiting events...</p>}
              </div>
            </div>
          </div>

          {/* CONTROLS PANEL */}
          <div className="md:col-span-8 flex flex-col gap-6">
            
            <div className="glass-card p-6 md:p-8 flex flex-col min-h-[300px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-cyan-400" />
                  Manual Relays
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => sendCommand('all_on')}
                    className="text-[10px] uppercase tracking-widest font-bold px-5 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors border border-cyan-500/20 hover:border-cyan-400/50"
                  >
                    Set All On
                  </button>
                  <button 
                    onClick={() => sendCommand('all_off')}
                    className="text-[10px] uppercase tracking-widest font-bold px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-gray-400 border border-white/10"
                  >
                    Set All Off
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-grow">
                {[1, 2, 3, 4].map((num) => {
                  const rKey = `r${num}` as keyof RelayStatus;
                  const isOn = relayStatus[rKey] === 1;
                  const isPink = num % 2 === 0;
                  const activeColor = isPink ? 'bg-pink-500 shadow-[0_0_12px_#ff00e5]' : 'bg-cyan-500 shadow-[0_0_12px_#00f2ff]';
                  const buttonClass = isOn 
                    ? (isPink ? 'active-toggle-pink text-white border-transparent' : 'active-toggle-blue text-white border-transparent')
                    : 'bg-black/30 border border-white/10 text-gray-400 hover:bg-white/5';

                  return (
                    <div key={`relay-${num}`} className={`glass-card p-5 flex flex-col justify-between transition-colors ${isOn ? 'bg-white/5 border-white/20' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-300">Relay 0{num}</div>
                        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isOn ? activeColor : 'bg-gray-800'}`}></div>
                      </div>
                      <div className="mt-8 mb-6">
                        <div className={`text-xl font-bold mb-1 ${isOn ? (isPink ? 'text-pink-300' : 'text-cyan-300') : 'text-white'}`}>Light {num}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">STATUS: {isOn ? 'ON' : 'OFF'}</div>
                      </div>
                      <button
                        onClick={() => sendCommand(`r${num}_${isOn ? 'off' : 'on'}`)}
                        className={`w-full py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${buttonClass}`}
                      >
                        {isOn ? 'Turn Off' : 'Turn On'}
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
                    className="py-6 glass-card bg-white/5 text-left px-5 flex items-center justify-between group hover:bg-white/10 transition-all border border-transparent hover:border-cyan-500/30"
                 >
                    <div>
                      <div className={`text-sm font-bold tracking-wide ${relayStatus.v1 === 1 ? 'neon-blue' : ''}`}>DISCO MODE</div>
                      <div className="text-[10px] text-cyan-400 uppercase mt-1 tracking-widest font-mono">Pattern V1</div>
                    </div>
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${relayStatus.v1 === 1 ? 'border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(0,242,255,0.3)]' : 'border-white/20 text-white/30 group-hover:text-white'}`}>▶</div>
                 </button>

                 <button
                    onClick={() => sendCommand('v2_on')}
                    className="py-6 glass-card bg-white/5 text-left px-5 flex items-center justify-between group hover:bg-white/10 transition-all border border-transparent hover:border-pink-500/30"
                 >
                    <div>
                      <div className={`text-sm font-bold tracking-wide ${relayStatus.v2 === 1 ? 'neon-pink' : ''}`}>STEP MODE</div>
                      <div className="text-[10px] text-pink-400 uppercase mt-1 tracking-widest font-mono">Pattern V2</div>
                    </div>
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${relayStatus.v2 === 1 ? 'border-pink-400 text-pink-400 shadow-[0_0_10px_rgba(255,0,229,0.3)]' : 'border-white/20 text-white/30 group-hover:text-white'}`}>▶</div>
                 </button>

                 <button
                    onClick={() => sendCommand('v_stop')}
                    className="py-6 bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold uppercase tracking-widest rounded-3xl hover:bg-red-500/20 hover:border-red-500/40 transition-all flex items-center justify-center"
                 >
                    Stop Patterns
                 </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

