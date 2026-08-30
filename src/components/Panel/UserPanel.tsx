type UserPanelUser = {
  displayName: string;
  backgroundColor: string;
  avatarDir: string;
};

type UserPanelProps = {
  user: UserPanelUser | null;
  panelWidth: number;
};

/**
 * ユーザのアバター表示
 */
export default function UserPanel({ user, panelWidth }: UserPanelProps) {
  const width = panelWidth;
  const height = (width * 4) / 3;
  const photoURL = user ? `/avatar/user/${user.avatarDir}/peace.svg` : '';

  return (
    <div className="relative" style={{ width, height }}>
      <div
        className="absolute bottom-0 right-0"
        style={{
          width,
          height: width,
          borderRadius: '100% 0% 0% 100% / 100% 100% 0% 0%',
          backgroundColor: user ? user.backgroundColor : '#EEEEEE',
        }}
      />
      {user && (
        <div className="absolute bottom-0 right-0 p-0 m-0" style={{ width, height }}>
          <img style={{ width, height }} src={photoURL} alt={photoURL} />
        </div>
      )}
    </div>
  );
}
