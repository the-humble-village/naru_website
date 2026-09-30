import React from 'react';

type NameInputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * NameInput - text input for proper nouns (people, families, places).
 *
 * Keyboard autocorrect is disabled so real surnames aren't rewritten into
 * dictionary words (e.g. "Choc" becoming "Chocolate"). Autocapitalisation stays
 * on so the first letter of each name is capitalised without a shift press.
 *
 * Autocorrect is still wanted on prose fields such as visit notes - use a plain
 * <input> or <textarea> there.
 */
export const NameInput: React.FC<NameInputProps> = (props) => (
  <input
    type="text"
    autoCorrect="off"
    autoCapitalize="words"
    autoComplete="off"
    spellCheck={false}
    {...props}
  />
);

export default NameInput;
