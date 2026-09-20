import { Link } from 'react-router-dom';
import { Card } from '../components/ui';

export default function NotFound() {
  return (
    <Card>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p className="sub" style={{ marginBottom: 12 }}>주소가 잘못되었거나 존재하지 않는 항목입니다.</p>
      <Link to="/" className="btn sm">홈으로</Link>
    </Card>
  );
}
