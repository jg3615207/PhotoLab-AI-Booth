import React, { useState } from 'react';

interface VirtualKeyboardProps {
  onInput: (char: string) => void;
  onBackspace: () => void;
  onClose?: () => void;
}

export default function VirtualKeyboard({ onInput, onBackspace, onClose }: VirtualKeyboardProps) {
  const [isCaps, setIsCaps] = useState(false);

  const row1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const row2 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const row3 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
  const row4 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

  const handleKeyClick = (char: string) => {
    onInput(isCaps ? char.toUpperCase() : char);
  };

  return (
    <div className="virtual-keyboard-container">
      <div className="vk-row">
        {row1.map(key => (
          <button key={key} type="button" className="vk-btn" onClick={() => handleKeyClick(key)}>{key}</button>
        ))}
        <button type="button" className="vk-btn vk-btn-action" onClick={onBackspace}>⌫</button>
      </div>

      <div className="vk-row">
        {row2.map(key => (
          <button key={key} type="button" className="vk-btn" onClick={() => handleKeyClick(key)}>
            {isCaps ? key.toUpperCase() : key}
          </button>
        ))}
      </div>

      <div className="vk-row">
        <button type="button" className={`vk-btn vk-btn-action ${isCaps ? 'active' : ''}`} onClick={() => setIsCaps(!isCaps)}>⇪</button>
        {row3.map(key => (
          <button key={key} type="button" className="vk-btn" onClick={() => handleKeyClick(key)}>
            {isCaps ? key.toUpperCase() : key}
          </button>
        ))}
      </div>

      <div className="vk-row">
        {row4.map(key => (
          <button key={key} type="button" className="vk-btn" onClick={() => handleKeyClick(key)}>
            {isCaps ? key.toUpperCase() : key}
          </button>
        ))}
        <button type="button" className="vk-btn vk-btn-space" onClick={() => handleKeyClick(' ')}>Space</button>
        {onClose && (
          <button type="button" className="vk-btn vk-btn-action" onClick={onClose}>Done</button>
        )}
      </div>
    </div>
  );
}
