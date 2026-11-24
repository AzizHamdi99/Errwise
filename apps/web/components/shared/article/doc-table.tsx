interface Props {
  head: string[];
  rows: React.ReactNode[][];
}

export function DocTable({ head, rows }: Props) {
  return (
    // tabIndex lets keyboard users scroll a wide table
    <div tabIndex={0} className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-muted/50">
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-4 py-2.5 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t align-top">
              {row.map((cell, column) => (
                <td key={column} className="px-4 py-2.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
