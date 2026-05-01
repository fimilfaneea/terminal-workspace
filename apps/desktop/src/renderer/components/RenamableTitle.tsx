import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export interface RenamableTitleHandle {
  startEditing: () => void;
}

interface Props {
  title: string;
  onRename: (next: string) => void;
  className?: string;
  inputClassName?: string;
}

export const RenamableTitle = forwardRef<RenamableTitleHandle, Props>(
  function RenamableTitle(
    { title, onRename, className, inputClassName },
    ref,
  ): JSX.Element {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(title);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const committedRef = useRef(false);

    useImperativeHandle(
      ref,
      () => ({
        startEditing: () => {
          setValue(title);
          committedRef.current = false;
          setEditing(true);
        },
      }),
      [title],
    );

    useEffect(() => {
      if (!editing) return;
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, [editing]);

    const commit = (): void => {
      if (committedRef.current) return;
      committedRef.current = true;
      const trimmed = value.trim();
      if (trimmed.length > 0 && trimmed !== title) {
        onRename(trimmed);
      }
      setEditing(false);
    };

    const cancel = (): void => {
      committedRef.current = true;
      setValue(title);
      setEditing(false);
    };

    if (editing) {
      return (
        <input
          ref={inputRef}
          className={inputClassName ?? className}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancel();
            } else {
              e.stopPropagation();
            }
          }}
          onBlur={commit}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          spellCheck={false}
        />
      );
    }

    return (
      <span
        className={className}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setValue(title);
          committedRef.current = false;
          setEditing(true);
        }}
      >
        {title}
      </span>
    );
  },
);
