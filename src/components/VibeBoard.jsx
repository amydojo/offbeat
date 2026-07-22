import React from 'react';
import { useDrop } from 'react-dnd';

export default function VibeBoard({ items, onDrop }) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'tile',
    drop: (item) => {
      onDrop(item);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));
  return (
    <div
      ref={drop}
      className={`min-h-[150px] p-4 border-2 rounded-lg flex flex-wrap ${isOver ? 'border-green-400' : 'border-gray-600'}`}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="bg-purple-600 text-white px-2 py-1 m-1 rounded"
        >
          {item.name}
        </div>
      ))}
    </div>
  );
}
