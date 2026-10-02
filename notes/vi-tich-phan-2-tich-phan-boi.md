Ghi chú ôn tập: Tích phân bội (Vi Tích Phân 2). Nguồn: notes/_source/tich-phan-boi-va-bai-tap-mau.md, trang 150-178 của Bai giang tong hop.pdf (308 trang). Phạm vi: định nghĩa tích phân, tích phân bội trên hình chữ nhật và miền tổng quát, ý nghĩa, tính chất, định lý Fubini, bài tập mẫu.

## Định nghĩa tích phân bội

- Trang 152: phân hoạch của đoạn [a; b] là các số x0 = a < x1 < ... < xn = b chia đoạn thành n đoạn con [xi-1; xi], độ dài mỗi đoạn con là Δxi = xi - xi-1, i = 1, ..., n.
- Trang 152: độ mịn của phân hoạch là số lớn nhất trong các độ dài đoạn con, tức max Δxi (1≤i≤n). Độ mịn càng nhuyễn (nhỏ) thì số điểm chia càng nhiều, độ dài đoạn con càng nhỏ.
- Trang 152: lấy trên mỗi đoạn con một điểm đại diện xi* thuộc [xi-1; xi], tổng Sn = [mất ký hiệu ∫ và ∑] f(xi*)Δxi được gọi là tổng Riemann của f trên [a; b]. Công thức nằm ở đầu trang, các dòng còn lại là phần dưới, người học phải nối lại bằng tay.
- Trang 153: nếu điểm đại diện là biên trái xi* = xi-1 thì tổng Riemann ký hiệu Ln (chữ L ám chỉ "Left"); biên phải xi* = xi thì Rn ("Right"); trung điểm thì Mn ("Midpoint"). Công thức bảng trên, phần dưới bị cắt.
- Trang 154: định nghĩa tích phân: f khả tích trên [a; b] nếu tồn tại một số thực (ký hiệu bởi ký hiệu tích phân của f) sao cho: với mọi ε > 0, tồn tại δ > 0, nếu phân hoạch có độ mịn nhỏ hơn δ thì |tổng Riemann - giá trị đó| < ε, với xi* chọn tùy ý. Khi đó số đó được gọi là tích phân của f trên [a; b].
- Trang 155: tích phân của f là một số mà tổng Riemann có thể gần nó tùy ý miễn là lấy phân hoạch đủ mịn. Chữ "S kéo dài" do Leibniz đưa ra, ám chỉ S là viết tắt của "sum" (tổng Riemann), khi độ mịn tiến về 0 thì được tích phân.
- Trang 157: tích phân hàm 2 biến trên hình chữ nhật R = [a; b] × [c; d]: chia [a; b] thành n đoạn con độ dài Δxi, chia [c; d] thành m đoạn con độ dài Δyj; tập P các "nút mạng" {xi; yj} gọi là phân hoạch của R.
- Trang 158: tích Descartes tạo ra mn hình chữ nhật con Rij = [xi-1; xi] × [yj-1; yj], diện tích Rij bằng ΔxiΔyj. Tổng Riemann của f trên R: sigma theo i và j của f(xij*; yj*) Rij.
- Trang 159: định nghĩa: f khả tích trên R khi có một số thực sao cho với mọi ε > 0, tồn tại δ > 0, bất kỳ phân hoạch nào có độ mịn nhỏ hơn δ thì |tổng Riemann - số đó| < ε. Khi f khả tích thì số đó gọi là tích phân của f trên R, tổng Riemann là giá trị xấp xỉ.
- Trang 162: tích phân trên miền phẳng tổng quát: giả sử f xác định trên D nằm trong hình chữ nhật R, đặt F(x; y) = f(x; y) nếu (x; y) thuộc D, F = 0 nếu (x; y) thuộc R \ D. Nếu F khả tích trên R thì nói f khả tích trên D và tích phân của f trên D bằng tích phân của F trên R.
- Trang 163: diện tích của miền phẳng tổng quát D được định nghĩa là tích phân trên D của hàm hằng 1, miễn là hàm 1 khả tích; khi đó D được nói là có diện tích.
- Trang 164: định lý (không chứng minh): D có diện-tích-0 khi và chỉ khi phủ được bởi hữu hạn các ô chữ nhật có tổng diện tích nhỏ hơn số bất kỳ cho trước; D có diện tích khi và chỉ khi biên của D có thể-tích-0; f xác định, bị chặn trên D có thể tích, tập gián đoạn không đáng kể thì f khả tích; đồ thị hàm liên tục trên đoạn là đường cong diện-tích-0, đồ thị hàm 2 biến liên tục trên hình chữ nhật là mặt cong thể-tích-0.
- Trang 168: một hộp R n-chiều là tập con của Rn dạng tích Descartes [a1; b1] × ... × [an; bn]; thể tích n-chiều là tích (b1 - a1)(b2 - a2)...(bn - an). Mỗi đoạn được chia thành mk đoạn con, tích Descartes các phân hoạch cho phân hoạch của hộp R, chia R thành m1m2...mn hộp con n-chiều Rc.
- Trang 169: định nghĩa tích phân trên hộp n-chiều: f khả tích trên R khi tồn tại một số thực sao cho với mọi ε > 0, tồn tại δ > 0, phân hoạch có độ mịn nhỏ hơn δ thì |tổng Riemann - số đó| < ε. Khi n = 2 hay viết f(x; y) dA hay f(x; y) dxdy; khi n = 3 viết f(x; y; z) dV hay dxdydz, gọi là tích phân bội ba, ba lớp.
- Trang 170: trên miền đa chiều tổng quát: miền D nằm trong hộp R, đặt F(x) = f(x) nếu x thuộc D, F = 0 nếu x thuộc R \ D; nếu F khả tích trên R thì f khả tích trên D, tích phân của f trên D bằng tích phân của F trên R. Thể tích n-chiều của D là tích phân trên D của hàm hằng 1 nếu hàm đó khả tích.
- Trang 171: định lý (không chứng minh) trên Rn: D có thể-tích-0 khi và chỉ khi phủ được bởi hữu hạn các hình hộp n-chiều có tổng thể tích nhỏ hơn số bất kỳ; D có thể tích khi và chỉ khi biên của D có thể-tích-0; f xác định, bị chặn trên D có thể tích, tập gián đoạn thể tích 0 thì f khả tích; đồ thị hàm liên tục trên đoạn là đường cong thể-tích-0, đồ thị hàm 2 biến liên tục trên hình chữ nhật là mặt cong thể-tích-0 trong Rn+1.

## Ý nghĩa thực tế

- Trang 150: mở đầu bằng câu hỏi "Diện tích là gì?" - đặt vấn đề cho cả phần.
- Trang 152: khi f >= 0 trên [a; b], tổng Riemann của f là tổng diện tích các hình chữ nhật trong hình minh họa.
- Trang 156: đặt câu hỏi thể tích hình khối kế bên là bao nhiêu; quy ước tài liệu tham khảo [1] giáo trình Giải tích 2 của Bộ môn Giải tích, [2] J. Stewart, Calculus 7th.
- Trang 159: khi f >= 0 và f khả tích trên R, tích phân của f trên R được xem là thể tích phần không gian phía dưới đồ thị của f và phía trên R.
- Trang 160: hồ nước hình chữ nhật 4m × 8m, độ sâu không đều, dùng bảng độ sâu để ước lượng lượng nước - ứng dụng tổng Riemann.
- Trang 161: thể tích khối bị bao bởi các mặt y = x^2, y = 2x, z = 0, z = x^2 + y^2.
- Trang 163: trị số diện tích của D bằng trị số thể tích của khối nằm trên D, dưới mặt phẳng z = 1.
- Trang 174: thể tích khối nằm dưới đồ thị hàm hai biến, trên tập xác định hình chữ nhật, có thể tính theo kỹ thuật cắt lớp: cắt vuông góc trục Ox hoặc Oy, kết quả thể tích có khác không?
- Trang 175: tích phân của f(x; y) dx là diện tích thiết diện vuông góc trục Oy tại y (nếu f >= 0); tích phân của f(x; y) dy là diện tích thiết diện vuông góc trục Ox tại x.

## Tính chất và cách dùng

- Trang 165: f, g khả tích trên D: (f + g), (f - g) khả tích và tích phân của f ± g bằng tích phân f ± tích phân g. Với mọi hằng số thực c: tích phân của c trên D bằng c nhân diện tích D; tích phân của c*f bằng c nhân tích phân f. Nếu f(x) ≤ g(x) trên D trừ tập D0 diện-tích-0 thì tích phân f ≤ tích phân g. Nếu f = g trên D trừ tập D0 diện-tích-0 thì tích phân f bằng tích phân g. Nếu D1, D2 có phần giao diện-tích-0 thì tích phân trên D1 ∪ D2 bằng tổng tích phân trên D1 và D2.
- Trang 172: các tính chất tương tự cho hàm khả tích trên D nằm trong Rn (tổng, hiệu, hằng số, so sánh, ràng buộc trên D trừ tập thể-tích-0, cộng tính trên hợp hai miền có phần giao thể-tích-0).
- Trang 175: định lý Fubini trên hình chữ nhật: f liên tục trên R = [a; b] × [c; d] thì tích phân trên R bằng tích phân lặp theo x trước y sau hoặc y trước x sau. Cách viết gọn gọi là tích phân lặp, lấy tích phân theo biến x trước, y sau (hoặc ngược lại).
- Trang 176: Fubini trên miền phẳng đơn giản theo phương Oy: D = {(x; y) | x thuộc [a; b], g1(x) ≤ y ≤ g2(x)}, g1, g2 liên tục; khi đó tích phân trên D bằng tích phân lặp dy dx (y trước, x sau).
- Trang 177: ví dụ: tính tích phân của x^2 + y^2 trên D bao bởi y = 2x và y = x^2; hướng dẫn các bước: tìm giao điểm hai đường, khắc họa D đơn giản theo phương Oy, cố định x xét đoạn thẳng nằm trong D, xác định đoạn tung độ của y, rồi đưa về tích phân lặp (y trước, x sau).
- Trang 178: Fubini trên miền phẳng đơn giản theo phương Ox: D = {(x; y) | y thuộc [c; d], h1(y) ≤ x ≤ h2(y)}, h1, h2 liên tục; tích phân trên D bằng tích phân lặp dx dy.

## Bài tập mẫu

- Trang 160: "Một hồ nước hình chữ nhật kích thước 4m × 8m có độ sâu không đều. Người ta đo được chiều sâu tại một số điểm trên hồ như trong bảng sau. Ví dụ trong bảng này độ sâu tại điểm cách bờ trái 5m và bờ trên 1m là 4,6m. Hãy ước lượng lượng nước trong hồ." Bài tập [1], 2.1.2; tham khảo [2], mục 15.1.
- Trang 160: phác họa hình khối có thể tích cho bởi tích phân trên [0;1] × [0;1] của 4 - x - 2y; và tích phân trên [0;1] × [0;1] của 2 - x^2 - y^2; phác họa khối có thể tích tích phân của 9 - y^2 trên R = [0; 4] × [0; 2].
- Trang 160, bảng số liệu: vị trí dọc 1, 3, 5, 7; dòng 1: 3,1 - 4,5 - 4,6 - 4,0; dòng 3: 3,7 - 4,1 - 4,5 - 4,4.
- Trang 166: "Tính tích phân của các hàm sau: a) f(x) = 2 nếu 0 ≤ x ≤ 1, x ≠ 1/2; 0 nếu x = 1/2. b) f(x,y) = 4 nếu 0 ≤ x ≤ 1, 0 ≤ y ≤ 1, (x; y) ≠ (1/2; 1/2); 5 nếu (x; y) = (1/2; 1/2)." Bài tập trong [1], 2.1.3 đến 2.1.6.
- Trang 173: Bài tập [1], 2.1.7 đến 2.1.10.
- Trang 177: "Ví dụ. Hãy tính tích phân của x^2 + y^2 trên miền D bị bao quanh bởi các đường y = 2x và y = x^2."

## Lỗi kỹ thuật cần biết

- Font toán trong nguồn PDF không có bảng ToUnicode: ký hiệu ∫, ∬, ∑ và dấu giới hạn trên/dưới bị decode thành ký tự vô nghĩa; các dòng đánh dấu [mất ký hiệu ∫ và ∑] là các dòng đó. Trên các dòng ấy vẫn đọc được số, biến, diện tích và miền tích - chỉ mất ký hiệu tích phân. Không được tự điền ký hiệu vào chỗ bị mất.
- Công thức trong nguồn hay bị cắt thành nhiều dòng: phải nối các dòng lại trước khi kết luận. Ví dụ ở trang 152: tổng Sn được ghi thành nhiều dòng gồm "Sn = [mất ký hiệu]", "i = 1 đến n", "f(xi*) Δxi"; nhưng que đi xuống. Trường hợp như vậy ghi: công thức nằm ở đầu trang, các dòng còn lại là phần dưới, người học phải nối lại bằng tay.
- File nguồn dùng font cũ (VNI/TCVN3) nên chữ tiếng Việt bị decode sai kiểu "Chöông" = "Chương". Hiểu nghĩa qua công thức, số liệu và cấu trúc; khi trích giữ nguyên như nguồn và giải thích nghĩa đúng ngay sau dòng trích.
- Một số ký hiệu trong nguồn bị vỡ đầu hoặc mất đoạn: trích nguyên văn và giải thích ngay sau, không tự sửa.
