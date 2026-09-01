type FairyPanelRepr = {
  botName: string;
  avatar: string;
  backgroundColor: string;
  botState?: string;
};

type FairyPanelProps = {
  repr: FairyPanelRepr;
};

/**
 * チャットボットのアバターと背景を表示する
 */
export default function FairyPanel({ repr }: FairyPanelProps) {
  const width = 192;
  const height = (width * 4) / 3;

  return (
    <div className="relative" style={{ width, height }}>
      <div
        className="absolute bottom-0 left-0"
        style={{
          width,
          height: width,
          borderRadius: '0% 100% 100% 0% / 100% 100% 0% 0%',
          backgroundColor: repr.backgroundColor,
        }}
      />
      <div className="absolute bottom-0 left-0 p-0 m-0" style={{ width, height }}>
        <img
          style={{ width, height }}
          src={`/api/bots/${repr.botName}/avatar/${repr.avatar}.svg`}
          alt={repr.botState}
        />
      </div>
    </div>
  );
}
