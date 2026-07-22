import React from 'react';
import { useDrag } from 'react-dnd';

export default function VibeTile({ id, name }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'tile',
    item: { id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));
  return (
    <div
      ref={drag}
      className={`p-3 m-2 rounded-lg shadow-md cursor-move bg-indigo-500 text-white ${isDragging ? 'opacity-50' : ''}`}
    >
      {name}
    </div>
  );
}
