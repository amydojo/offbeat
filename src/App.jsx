import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import VibeTile from './components/VibeTile';
import VibeBoard from './components/VibeBoard';
import * as Tone from 'tone';
import { playLoop, startRecording, stopRecording } from './lib/audioEngine';

const samples = [
  { id: 'loop1', name: 'Drums', src: '/loop1.mp3' },
  { id: 'loop2', name: 'Bass', src: '/loop2.mp3' },
  { id: 'loop3', name: 'Melody', src: '/loop3.mp3' },
];

function App() {
  const [timeline, setTimeline] = useState([]);
  const [recording, setRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleDrop = async (item) => {
    const sample = samples.find((s) => s.id === item.id);
    if (sample) {
      setTimeline((prev) => [...prev, sample]);
      await Tone.start();
      await playLoop(`${sample.id}-${Date.now()}`, sample.src);
    }
  };

  const toggleRecord = async () => {
    if (!recording) {
      await startRecording();
      setRecording(true);
    } else {
      const url = await stopRecording();
      setRecording(false);
      setDownloadUrl(url);
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen p-4 text-white">
        <h1 className="text-4xl font-bold mb-4">Offbeat Music Playground</h1>
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/4 mb-4 md:mb-0">
            <h2 className="text-xl mb-2">Vibe Tiles</h2>
            {samples.map((tile) => (
              <VibeTile key={tile.id} id={tile.id} name={tile.name} />
            ))}
          </div>
          <div className="flex-1 md:ml-4">
            <h2 className="text-xl mb-2">Timeline</h2>
            <VibeBoard items={timeline} onDrop={handleDrop} />
            <button
              className={`mt-4 px-4 py-2 rounded ${recording ? 'bg-red-600' : 'bg-green-600'}`}
              onClick={toggleRecord}
            >
              {recording ? 'Stop Recording' : 'Record'}
            </button>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download="offbeat.wav"
                className="ml-4 underline text-blue-300"
              >
                Download Recording
              </a>
            )}
          </div>
        </div>
      </div>
    </DndProvider>
  );
}

export default App;
