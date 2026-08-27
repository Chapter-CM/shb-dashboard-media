Option Explicit

' ================================================================
' SHB CM Campaign Tracker v4.90
' Stack  : Outlook Classic Desktop/Mobile (VBA macro) -> /api/track public -> MySQL
'
' Nguon chinh thuc DUY NHAT cua macro nay la file trong repo shb-dashboard-media
' (repo email-tracker-data cu da nghi, khong dung nua - tranh update nham 2 noi).
'
' CHANGES vs v4.44
'   - Nguoi dung gap gioi han dung luong hop thu (1.2GB) trong khi 1 campaign co
'     the len toi 3500 mail (~3.5GB neu giu nguyen HTML/anh trong Sent Items).
'     RecallCampaign() chi can ban sao con TON TAI trong Sent Items de mo va goi
'     lenh recall - KHONG can noi dung day du (nguoi nhan da nhan ban day du roi).
'     Vi vay: ngay sau khi gui tung mail (m.send), rut gon NGAY body cua ban luu
'     trong Sent Items thanh 1 dong placeholder ngan, giu nguyen Subject/To/Date
'     va 2 UserProperties CMSlug/CMEID (de RecallCampaign() van loc/tim dung).
'     Dung luong moi ban ghi giam tu hang tram KB (HTML + anh) xuong con vai
'     tram byte - giai quyet duoc bai toan day hop thu ma KHONG lam mat kha
'     nang recall.
'   - Them ham rieng ShrinkSentCopy() dam nhiem viec rut gon nay, goi ngay sau
'     m.send trong DoFullMode.
'   - Bo 4 macro phu (CleanRecallNotifications, Start/StopRecallNotification-
'     Watcher, CleanCampaignCopies) khoi Alt+F8 theo yeu cau nguoi dung - chi
'     giu SendCampaign/RecallCampaign. Logic bat watcher gop thang vao dau
'     RecallCampaign(). CleanCampaignCopies la code chet (khong con luong nao
'     tao ban nhap [CM-COPY] trong Drafts nua) nen bo han.
'
' CHANGES vs v4.45
'   - Fix ShrinkSentCopy() KHONG chay: goi rut gon ngay sau m.send() bi loi
'     ngam (Outlook khong cho sua/luu MailItem tin cay ngay sau khi Send -
'     item coi nhu da "chot", On Error Resume Next nuot mat loi nen khong
'     bao ra). Doi sang ham moi ShrinkCampaignSentItems(slug): quet lai toan
'     bo Sent Items theo CMSlug MOT LAN duy nhat, SAU KHI ca batch da gui
'     xong (giong cach RecallCampaign() dang quet) - luc nay item da on dinh
'     trong Sent Items nen sua/luu duoc binh thuong. Bo ham ShrinkSentCopy()
'     cu (khong con goi tu vong lap gui nua).
'
' CHANGES vs v4.46
'   - Nguoi dung lo ngai voi campaign lon (3000-3500 mail), hop thu van phinh
'     to TRONG LUC dang gui vi rut gon chi chay 1 lan luc cuoi. Them
'     SHRINK_EVERY = 300: rut gon DINH KY moi 300 mail trong luc gui, khong
'     phai doi het batch.
'   - Test recall bi "cannot be recalled" khi tu gui cho chinh minh - day la
'     GIOI HAN THUC SU cua Exchange (tu gui cho minh khong di qua dung luong
'     transport de nhan dien duoc lenh recall), khong phai loi macro. Recall
'     chi hoat dong dung khi gui cho nguoi khac that trong to chuc.
'   - Them lai CleanRecallNotifications() (Private, an khoi Alt+F8) lam
'     phuong an du phong don thong bao Recall Success/Failure con sot -
'     watcher van tu dong xoa NGAY binh thuong, macro nay chi de du phong.
'
' CHANGES vs v4.47
'   - Nguoi dung bao "Da rut gon Sent Items: 0" du code khong doi so voi
'     ban da chay thanh cong truoc do - nghi ngo co loi that (vd chinh sach
'     Retention/Litigation Hold cua Exchange chan sua Sent Items) dang bi
'     "On Error Resume Next" nuot mat, khong hien ra. Them tham so diag
'     (ByRef) cho ShrinkCampaignSentItems() de tra ve chi tiet loi that su
'     (Err.Number/Description) hoac bao ro neu khong tim thay mail nao
'     khop CMSlug - hien truc tiep trong MsgBox "Hoan thanh!" de chan doan.
'
' CHANGES vs v4.48
'   - Diag hien ra: "khong tim thay mail nao co CMSlug" - tim ra nguyen nhan
'     that su: mail vua .send() CHUA XUAT HIEN kip trong Sent Items.Items
'     luc ham quet chay (Outlook can thoi gian day tu Outbox qua Sent Items,
'     khong phai tuc thi, tuy toc do mang/Exchange). Doi 3s co dinh 1 lan
'     sang POLL: quet lai toi da 6 lan, cach nhau 3s (toi da 18s them), dung
'     som ngay khi da rut gon du so mail thanh cong (sentOK).
'
' CHANGES vs v4.49
'   - Van ra 0 du da doi du lau (mail xac nhan CO nam trong Sent Items qua
'     kiem tra thu cong). Nghi ngo UserProperty CMSlug khong doc lai duoc
'     dung gia tri sau khi mail da "chot" trong Sent Items. Them chan doan
'     sau: doc va hien thi CMSlug thuc te cua 3 mail gan nhat trong Sent
'     Items (bat ke co khop hay khong) de xac dinh chinh xac van de.
'
' CHANGES vs v4.50
'   - Chan doan xac nhan: mail vua gui KHONG doc duoc CMSlug dung trong vong
'     vai chuc giay, nhung mail gui truoc do ~15-20 phut lai doc dung. Ket
'     luan: Exchange SHB can VAI PHUT (khong phai vai giay) de mail "chot"
'     du de sua duoc, khong phai loi code. Bo vong lap retry co gang cho
'     ngay tai SendCampaign (khong thuc te). Thay vao do: gop rut gon vao
'     ngay trong RecallCampaign() (thoi diem nguoi dung tu nhien da doi du
'     lau) - moi mail tim thay de recall cung duoc rut gon luon. SendCampaign
'     van thu rut gon 1 lan luc cuoi (bat duoc phan mail gui som trong batch
'     lon da kip on dinh), phan con lai se tu rut gon khi chay RecallCampaign.
'
' CHANGES vs v4.51
'   - Nguoi dung can test duoc voi 1 mail (khong the doi den 100-200 mail moi
'     thay rut gon dinh ky chay). Giam SHRINK_EVERY tu 300 xuong 100. Quan
'     trong hon: doi CO GIOI HAN (toi da 8 phut, kiem tra moi 20 giay, dung
'     som ngay khi du) o cuoi SendCampaign thay vi chi thu 1 lan roi bao
'     "se tu rut gon sau" - ap dung cho MOI truong hop (ca gui 1 mail test
'     lan gui campaign that), nguoi dung thay ket qua that ngay, khong can
'     doan hay lam gi them.
'
' CHANGES vs v4.52
'   - Nguoi dung KHONG muon SendCampaign bi chan (block) doi - can duoc tra
'     lai quyen dieu khien ngay (vd de huy gui giua chung trong Outbox neu
'     can). Bo han doan doi co gioi han. Thay bang: thu rut gon 1 lan ngay
'     (khong doi), neu con thieu thi dat lich Outlook Reminder (TaskItem an,
'     ScheduleShrinkReminder()) de TU DONG chay ngam sau ~8 phut - can dan
'     doan code rieng vao ThisOutlookSession (Application_Reminder) de phan
'     tu dong nay hoat dong, xem huong dan kem theo file nay.
'
' CHANGES vs v4.53
'   - Loi Compile error "Only comments may appear after End Sub, End Function"
'     tai dong Private Const SHRINK_TASK_PREFIX - kiem tra file goc khong co
'     ky tu la, nghi do qua trinh sua tay/dan lai truoc do bi lan ky tu.
'     Don gian hoa: bo dong Const rieng, gop thang chuoi "[SHB-AutoShrink] "
'     vao ngay trong ScheduleShrinkReminder() de giam diem co the loi.
'
' CHANGES vs v4.54
'   - Giam thoi gian cho Reminder tu 10 phut xuong 8 phut (muc thap nhat an
'     toan dua tren du lieu thuc te da quan sat - Exchange SHB can khoang
'     5-8 phut de mail "chot" du de sua duoc).
'
' CHANGES vs v4.55
'   - Nguoi dung khong thich popup Outlook Reminder hien ra (du chi la hop
'     thoai nho) - BO HAN co che ScheduleShrinkReminder/TaskItem/Reminder.
'     SendCampaign gio chi thu rut gon 1 lan ngay luc cuoi (khong chan, khong
'     popup gi ca); phan con lai (neu co) se tu rut gon khi chay
'     RecallCampaign() sau nay - khong can setup gi them trong
'     ThisOutlookSession nua (doan code Application_Reminder da dan truoc do
'     co the xoa di, khong con tac dung).
'
' CHANGES vs v4.57 (+ RecallNotifWatcher.cls)
'   - TIM RA NGUYEN NHAN GOC watcher khong bao gio xoa duoc thong bao Recall:
'     thong bao "Message Recall Success/Failure" la loai ReportItem (Class=
'     olReport), KHONG PHAI MailItem (olMail) - dieu kien loc "If Item.Class
'     = olMail" trong RecallNotifWatcher.cls tu truoc gio luon SAI cho loai
'     item nay nen khong bao gio chay toi doan xoa. Da sua RecallNotifWatcher.cls:
'     bo dieu kien loc Class, doc .subject truc tiep cho MOI item (ca MailItem
'     lan ReportItem deu co .Subject).
'   - Watcher gio LUON tao lai MOI moi lan RecallCampaign() chay (thay vi chi
'     tao khi dang Nothing) - tranh giu tham chieu CU sau khi RecallNotifWatcher.cls
'     duoc cap nhat. Bo MsgBox debug watcher tam thoi (da dung de chan doan).
'
' CHANGES vs v4.58
'   - Nguoi dung can RECALL GAP HANG LOAT ngay sau khi gui, khong the doi vai
'     phut de UserProperty CMSlug on dinh. Them SaveCampaignInfo()/LoadCampaignInfo()
'     (dung SaveSetting/GetSetting - luu vao Windows Registry cua may, khong
'     can setup gi them): luc gui, luu lai Subject GOC (khong doi trong vong
'     lap) + khoang thoi gian batch gui. RecallCampaign() gio uu tien tim mail
'     bang Subject + SentOn (thuoc tinh GOC, doc duoc TUC THI) truoc, chi dung
'     UserProperty CMSlug lam cach tim BO SUNG (van giu de chinh xac hon khi
'     da doc duoc). Nho vay co the RecallCampaign() NGAY SAU KHI SendCampaign()
'     vua xong, khong can doi Exchange "chot" mail nua.
'
' CHANGES vs v4.59 (+ RecallNotifWatcher.cls)
'   - Nguoi dung phat hien thong bao Recall Success/Failure bi watcher xoa
'     van CHI chuyen vao Deleted Items (khong mat han) - van chiem dung
'     luong, campaign lon van co the lam day hop thu. Them WithEvents thu 2
'     (DeletedItemsItems) trong RecallNotifWatcher.cls, theo doi Deleted
'     Items - khi thong bao vua bi chuyen toi do, xoa THEM 1 LAN NUA ngay
'     tai do de xoa VINH VIEN (hanh vi chuan Outlook: xoa item dang o san
'     trong Deleted Items = xoa han, khong con noi de chuyen tiep).
'
' CHANGES vs v4.60
'   - Recall gap van khong tim thay mail o may/campaign thuc te (dung Subject
'     + SentOn nhung matched=0), dau khong ro nguyen nhan qua vai lan test.
'     Them chan doan chi tiet vao thong bao "khong tim thay": hien ro Subject/
'     khoang thoi gian da luu (LoadCampaignInfo) VA Subject/SentOn thuc te cua
'     3 mail gan nhat trong Sent Items, de so sanh truc tiep va xac dinh dung
'     cho lech (vd khac Subject do ky tu dac biet, hoac SentOn ngoai khoang
'     thoi gian du kien).
'
' CHANGES vs v4.61
'   - Chan doan lo ro nguyen nhan that: Subject da luu bi mat 1 ky tu co dau
'     tieng Viet (bien thanh dau "?") khi luu qua SaveSetting/GetSetting
'     (Windows Registry chi ho tro ANSI/ASCII co ban qua API nay). Subject
'     sai lech (mat du lieu Unicode) nen KHONG BAO GIO
'     khop voi Subject that trong Sent Items. Sua: them Utf8ToHex()/HexToUtf8()
'     (dung ADODB.Stream, cung co che voi UrlEnc() da co san) - ma hoa Subject
'     sang chuoi HEX (chi 0-9/A-F, an toan tuyet doi) truoc khi SaveSetting,
'     giai ma lai luc GetSetting. Cac campaign gui TRUOC ban nay van co the bi
'     sai (da luu hong roi) - can gui lai/cho CMSlug on dinh; campaign gui SAU
'     ban nay se luu dung Unicode, tim nhanh hoat dong binh thuong.
'
' CHANGES vs v4.62
'   - Campaign lon (200+ nguoi) van khong rut gon duoc du doi HANG GIO - loi
'     RIENG: ShrinkCampaignSentItems() (goi trong luc gui va luc RecallCampaign)
'     chi duoc sua tim nhanh o RecallCampaign(), QUEN sua chinh ham nay - van
'     chi dua vao CMSlug (co the khong bao gio doc duoc on dinh voi mot so
'     mailbox/campaign). Sua: them cung dieu kien Subject + SentOn nhu
'     RecallCampaign() vao ShrinkCampaignSentItems() - rut gon trong luc gui
'     (SHRINK_EVERY, cuoi SendCampaign) gio cung tim nhanh duoc, khong con
'     phu thuoc hoan toan vao CMSlug nua.
'
' CHANGES vs v4.63
'   - Nguoi dung nhan manh: "gui xong la phai TU rut gon", khong chap nhan
'     phai bam RecallCampaign() rieng, khong doi (block), khong popup. Them
'     Windows Timer chay NGAM HOAN TOAN (SetTimer/KillTimer qua user32,
'     AddressOf ShrinkTimerProc): neu cuoi SendCampaign() van con mail chua
'     rut gon duoc, tu dong dat lich kiem tra lai moi 60 giay (toi da 12 lan
'     = 12 phut), khong can nguoi dung lam gi, khong hien them hop thoai nao.
'     Day la lua chon ky thuat DUY NHAT dap ung duoc yeu cau "tu dong hoan
'     toan, khong cho, khong popup" - da tung ngan ngai vi lo rui ro timing,
'     nhung cac phuong an khac (Reminder popup, cho block) deu bi tu choi.
'
' CHANGES vs v4.64
'   - Loi runtime "Type mismatch" ngay dong SetTimer(...) - tren may 64-bit
'     (Office 64-bit, pho bien hien nay), API user32 tra ve kieu LongPtr
'     (8 byte) chu khong phai Long thuong (4 byte); bien "h" nhan ket qua
'     lai khai bao cung Long -> tran/khong khop kieu. Sua: khai bao "h" theo
'     dieu kien bien dich #If VBA7 (LongPtr) / #Else (Long) giong cach da
'     dung cho chinh khai bao SetTimer/KillTimer o tren.
'
' CHANGES vs v4.65-4.67 (ban chot sau khi XAC NHAN Timer chay dung)
'   - Da xac nhan bang log thuc te: Timer nen HOAT DONG (callback duoc
'     Windows goi lai, "shrunk=1/1") - mail tu rut gon sau vai phut ma
'     nguoi dung KHONG can bam gi. Da go toan bo code chan doan tam thoi
'     (macro DebugShowTimerLog + ghi log qua SaveSetting).
'   - Fix: gui campaign MOI trong luc campaign truoc con dang cho rut gon
'     thi campaign cu bi bo do dang (quan sat thuc te: mail 1.5 khong duoc
'     rut gon vi 1.6 gui ngay sau do). Nay StartShrinkTimer() vet not
'     campaign cu them 1 lan truoc khi chuyen sang theo doi campaign moi.
'   - Fix an toan: bien module-level cua VBA bi xoa trang khi VBA project
'     reset, NHUNG timer Windows van song -> callback se chay mai voi slug
'     rong. Nay callback tu tat timer khi khong con slug, va
'     StopShrinkTimer() goi KillTimer VO DIEU KIEN (truoc day kiem tra co
'     m_ShrinkTimerOn - chinh co nay cung bi xoa khi reset nen khong bao
'     gio tat duoc timer "mo coi").
'
' CHANGES vs v4.72
'   - RecallCampaign() bao "khong tim thay mail" du campaign vua gui xong
'     that su van con trong Sent Items - nguyen nhan: ca RecallCampaign()
'     lan ShrinkCampaignSentItems() van chi dung GetDefaultFolder(olFolder-
'     SentMail), tuc CHI quet Sent Items cua 1 account MAC DINH duy nhat
'     trong profile. Neu campaign gui tu 1 account KHAC (khong phai mac
'     dinh) - vd profile co nhieu account cung luc - ham se quet nham
'     Sent Items rong/sai cua account mac dinh va khong bao gio tim ra.
'     Da sua ca 2 ham quet Sent Items cua TAT CA account trong profile
'     (giong co che da ap dung cho ArchiveModule.bas truoc do), dedup
'     theo StoreID de khong quet trung 1 mailbox 2 lan.
'
' CHANGES vs v4.73
'   - Nguoi dung bao anh nhung (chen qua Insert > Pictures, co gan
'     hyperlink) trong campaign gui hang loat KHONG hien thi o nguoi
'     nhan, du gui thanh cong - nghi ngo lien quan toi buoc draft.Copy()
'     roi gan lai m.HTMLBody bang chuoi HTML cu trong DoFullMode(). Xac
'     nhan day la loi kinh dien cua Outlook VBA: draft.Copy() co the sinh
'     Content-ID MOI cho tung anh nhung trong ban copy, khong con khop
'     voi chuoi "cid:..." cu con nam trong HTMLBody (chuoi nay khong doi
'     kem theo). Them GetAttachmentCid()/FixInlineImageCids(): ghi lai
'     Content-ID GOC cua tung anh nhung truoc vong lap, sau moi lan
'     draft.Copy() se doi chieu Content-ID MOI cua ban copy va thay the
'     lai trong HTML truoc khi gan HTMLBody - anh nhung se hien dung tro
'     lai. (Rieng anh dang link ngoai/URL that su thi khong lien quan loi
'     nay, chi anh huong anh NHUNG thuc su qua Insert > Pictures.)
'
' CHANGES vs v4.74
'   - Nguoi dung bao rut gon (Shrink) khong con hoat dong sau khi doi
'     sang quet da-account (v4.73) - trong khi ban v4.68 truoc do rut
'     gon rat tot. Nghi ngo acc.DeliveryStore khong tra ve duoc voi kieu
'     account/profile nao do tren may nguoi dung (loi bi nuot boi On
'     Error Resume Next, khong hien ra), khien vong lap da-account bo
'     sot toan bo, khac voi truoc day GetDefaultFolder() luon chac chan
'     tra ve it nhat 1 folder. Them lop DU PHONG cho ca ShrinkCampaign-
'     SentItems() va RecallCampaign(): neu vong lap da-account khong quet
'     duoc account nao (accountsScanned = 0), tu dong quay lai dung cach
'     cu GetDefaultFolder(olFolderSentMail) nhu v4.68 - dam bao khong bao
'     gio te hon ban cu, du van uu tien quet da-account truoc. Tach logic
'     quet 1 folder ra rieng (ScanFolderForShrink/ScanFolderForRecall) de
'     dung chung cho ca 2 duong (da-account va du phong), tranh sao chep
'     code 2 lan de giam nguy co lech logic.
'
' CHANGES vs v4.75
'   - Nguoi dung bao link tracking "tho" bi lo ra ngay trong phan preview
'     cua Outlook (doan chu xam duoi Subject trong danh sach Inbox).
'     Nguyen nhan: prevTxt (preview text) truoc day tu dong lay NGUYEN
'     dong dau tien cua draft.body, khong loc gi ca - neu dong dau tien
'     do vo tinh la 1 link tran, chinh link do bi nhet thang vao preheader
'     an (hidden div ngay sau <body>) roi "lo" ra thanh preview. Them
'     FindFirstNonLinkLine(): duyet tung dong cua body, BO QUA dong trong
'     hoac dong chi la 1 link http/https tran, lay dong dau tien co chu
'     THUC SU lam preview text - khong con nguy co link "tho" lot vao
'     preview nua.
'
' CHANGES vs v4.76
'   - Nguoi dung muon TU GO preview text bang tay (tieng Viet co dau)
'     thay vi luon phai lay tu dong tu noi dung mail. Them InputBox rieng
'     cho preview text (buoc 3.5/4), goi y san gia tri tu FindFirstNon-
'     LinkLine() nhung cho sua/go lai tuy y - InputBox dung String Unicode
'     binh thuong nen go tieng Viet co dau khong bi loi mat dau (khac
'     voi SaveSetting/GetSetting da gap loi nay o cho khac trong file).
'
' CHANGES vs v4.77
'   - Nguoi dung bao ten chien dich go tieng Viet co dau hien DUNG trong
'     Subject email (khong qua MakeSlug) nhung Dashboard (doc truong
'     "campaign" - chinh la slug - tu API tracking) lai hien SAI/thieu
'     chu. Nguyen nhan: MakeSlug() truoc day LOAI BO HOAN TOAN ky tu co
'     dau (vd "Thong bao" -> "thng-bo", mat han chu "o" va "a" cua "ô","á")
'     thay vi chuyen ve khong dau. Them StripVNDiacritics() (giong
'     NormalizeVN() da dung cho ArchiveModule.bas) goi TRUOC buoc loc
'     ASCII trong MakeSlug() - tu nay slug se giu day du chu (vd
'     "thong-bao-...") thay vi bi cut mat. Luu y: cac campaign da gui
'     TRUOC ban nay van giu slug cu (da luu trong UserProperty/Registry),
'     chi cac campaign gui SAU khi cap nhat moi co slug day du.
'
' CHANGES vs v4.78
'   - Nguoi dung bao RecallCampaign() voi campaign lon cham gap doi so
'     voi luc gui - phan tich dung: giai doan 1 (vong lap tu dong mo tung
'     mail + bam Recall qua SendKeys/ExecuteMso) va giai doan 2 (Outlook
'     thuc su truyen di cac mail "yeu cau thu hoi" dang xep trong Outbox
'     qua Exchange - ban chat cung la gui mail, ton thoi gian tuong tu
'     luc gui ban dau) truoc day chay TUAN TU: doi het giai doan 1 xong
'     Outlook moi bat dau giai doan 2. Them SendAndReceive dinh ky (moi
'     20 mail, trong ScanFolderForRecall) + 1 lan cuoi cung sau vong lap
'     - de Outlook bat dau truyen Outbox NGAY trong luc vong lap van con
'     chay, giup 2 giai doan chay gan nhu song song thay vi noi duoi
'     nhau, giam dang ke tong thoi gian Recall.
'
' CHANGES vs v4.79
'   - Nguoi dung xac nhan preview text go qua InputBox (them o v4.77) bi
'     mat 1 so ky tu tieng Viet mo rong (vd "ỏ" -> "?", trong khi "à","ũ"
'     van dung) - xac dinh day la gioi han co that cua VBA InputBox: no
'     chuyen chuoi qua ANSI (Windows-1258) truoc khi tra ve, ma codepage
'     nay khong co san mot so to hop dau tieng Viet nen bi thay bang "?".
'     Bo InputBox cho preview text, thay bang GetClipboardText() (dung
'     CreateObject("MSForms.DataObject"), khong can them Reference) -
'     doc thang tu Clipboard (CF_UNICODETEXT, giu nguyen Unicode) thay vi
'     qua InputBox. Quy trinh moi: nguoi dung Copy (Ctrl+C) doan chu
'     muon dung TRUOC, roi chon "Co" trong hop thoai xac nhan.
'
' CHANGES vs v4.80
'   - Nguoi dung chi ra logic v4.80 bi nguoc: MsgBox/InputBox la
'     application-modal, KHOA TOAN BO Outlook (ke ca cua so soan mail)
'     trong luc hien ra - "Copy TRUOC roi bam Yes" la bat kha thi neu
'     nguon can Copy nam trong chinh Outlook (mail dang soan), vi luc do
'     Outlook da bi khoa boi chinh hop thoai vua hien ra. Sua: doc
'     Clipboard (GetClipboardText) NGAY DAU SendCampaign(), TRUOC ca
'     hop thoai dau tien - luc nay Outlook con hoan toan tu do, nguoi
'     dung Copy tu mail duoc binh thuong. Neu Clipboard co san chu (va
'     khac voi goi y tu dong), moi hoi co dung lam preview khong; neu
'     Clipboard trong hoac trung goi y thi bo qua cau hoi, dung luon
'     goi y tu dong - khong con buoc "copy giua chung" phi logic nua.
'
' CHANGES vs v4.81
'   - Nguoi dung yeu cau bo han co che Clipboard (v4.80/v4.81), quay lai
'     InputBox don gian nhu v4.77: de trong se tu dong dung goi y (lay
'     tu noi dung mail, giong cach Outlook tu lam), muon tu go thi go
'     TIENG ANH/ASCII de tranh gioi han co that cua VBA InputBox (mat
'     mot so ky tu tieng Viet mo rong nhu "ỏ" -> "?"). Bo ham
'     GetClipboardText() (khong con noi nao goi).
'
' CHANGES vs v4.82
'   - Nguoi dung muon giam toi da thoi gian Recall vi so nguoi da doc
'     duoc trong luc cho. RecallOneItem() truoc day cho CO DINH 1.5s
'     (mo Inspector) + 1s (focus) MOI mail bat ke may nhanh hay cham -
'     doi CHO SOM ngay khi dieu kien that su san sang (Inspector khong
'     con Nothing / CommandBars truy cap duoc), van giu nguyen TRAN AN
'     TOAN 1.5s/1s cho truong hop may cham (khong giam do tin cay). Chi
'     sua 2 doan cho nay - KHONG dong vao vong lap ExecuteMso/SendKeys
'     (0.4s moi lan thu, 1s giua cac lan retry) vi day la phan da tung
'     gay loi "thanh cong gia"/that bai ngam rat nhieu lan truoc day
'     (xem lich su CHANGES v4.63-4.67) khi bi rut ngan - giam them o day
'     rui ro cao hon loi ich, khong dong vao.
'
' CHANGES vs v4.83
'   - Nguoi dung bao recall tren account KHAC (khong phai account mac
'     dinh, cung 1 thiet bi/profile) van bi lot thong bao "Message Recall
'     Success/Failure" ve Inbox thay vi tu dong bi xoa. Nguyen nhan:
'     m_RecallWatcher (RecallNotifWatcher.cls) truoc day chi tao 1 watcher
'     DUY NHAT, theo doi Inbox/Deleted Items cua account MAC DINH - trong
'     khi thong bao Recall luon bay ve Inbox cua DUNG account vua dung de
'     recall (co the la account khac). Doi m_RecallWatcher (1 object) ->
'     m_RecallWatchers (Collection) - tao 1 watcher RIENG cho MOI account
'     trong profile (dedup theo StoreID, giong co che da dung cho Shrink/
'     Recall/Archive), co du phong quay lai 1 watcher cho account mac
'     dinh neu vi ly do nao do khong lay duoc danh sach account.
'
' CHANGES vs v4.84
'   - Nguoi dung bao mail nhan duoc TRONG TRON (mat het anh, chu ky, moi
'     thu) khi bat Click tracking voi mail co anh gan hyperlink + chu ky
'     phuc tap. Nguyen nhan: WrapLinks() khong phai 1 trinh phan tich
'     HTML that su, chi do chuoi thu cong tim "href="..."" - voi HTML
'     phuc tap (Outlook dung engine Word de dung, VML, style long nhau)
'     co the bat NHAM vi tri dau " dong, khien bien "orig" nuot ca mot
'     doan lon HTML that (anh/chu ky) roi bi XOA MAT khi ghep chuoi lai.
'     Day la loi CO SAN tu truoc (khong phai do cac ban va gan day gay
'     ra), chi moi bi phat hien do lan nay la lan dau test dung to hop
'     anh co link + chu ky phuc tap + bat Click tracking. Them 2 lop
'     phong ve trong WrapLinks(): (1) bo qua doan nghi ngo neu "orig" bat
'     duoc chua ky tu "<" hoac dai bat thuong (>2000 ky tu) - dau hieu
'     quet nham sang tag khac; (2) luoi an toan cuoi cung - WrapLinks chi
'     co the LAM DAI chuoi (thay href goc bang link tracking dai hon),
'     neu ket qua cuoi cung lai NGAN HON ban goc thi chac chan co loi
'     quet, HUY TOAN BO thay doi va tra ve nguyen ban HTML goc (thap chi
'     khong wrap duoc link con hon gui mail trong cho hang loat nguoi).
'
' CHANGES vs v4.85
'   - Loi mail nhan duoc TRONG TRON VAN CON du da co luoi an toan do dai
'     o v4.85 - vi lan nay nghi ngo KHONG PHAI do quet nham xoa mat noi
'     dung (truong hop do se lam NGAN chuoi, da bi luoi do dai chan lai),
'     ma do WrapLinks() bat NHAM thuoc tinh "href=" la HAU TO cua thuoc
'     tinh khac nhu "o:href=" hoac "xlink:href=" - day la thuoc tinh NOI
'     BO cua VML (Word dung de ve anh/shape trong chu ky phuc tap), KHONG
'     PHAI link nguoi dung. Ghi de gia tri thuoc tinh nay bang link
'     tracking khong lam NGAN chuoi (nen qua duoc luoi do dai) nhung co
'     the PHA VO cau truc VML, khien Word engine cua Outlook render toan
'     bo noi dung ra TRONG TRON o phia nguoi nhan dung nhu quan sat thuc
'     te. Sua: kiem tra ky tu NGAY TRUOC vi tri "href=" tim duoc - neu
'     khong phai khoang trang (tuc la mot phan cua ten thuoc tinh dai hon
'     nhu "o:href", "xlink:href") thi BO QUA hoan toan, khong dong vao,
'     chi xu ly dung thuoc tinh "href=" DOC LAP (thuoc tinh lien ket
'     chuan cua the <a>).
'
' CHANGES vs v4.86
'   - Loi mail nhan duoc TRONG TRON VAN CON du da bo qua "o:href" o
'     v4.86. Xem lai anh chup thuc te: Word tao ra CA HAI noi chua CUNG
'     1 URL (link SharePoint rat dai) khi anh duoc gan Hyperlink - href=
'     THAT tren the <a> boc quanh anh (cai v4.86 van xu ly binh thuong)
'     VA o:href tren <v:imagedata> ben trong (da bi bo qua tu v4.86).
'     Nghi ngo: rieng viec thay THE <a> BOC ANH bang link tracking rat
'     dai (nam chung cau truc voi VML/conditional comment phuc tap) da
'     du de lam Word engine render loi/trong, KE CA khi o:href khong con
'     bi dong vao nua. Sua AN TOAN HON: kiem tra neu href sap wrap nam
'     ngay TRUOC 1 the <img> hoac <v:imagedata> (trong pham vi toi da 800
'     ky tu, truoc khi gap </a> dong lai) - tuc la link nay dang BOC
'     QUANH 1 TAM ANH - thi BO QUA HOAN TOAN, khong tracking click cho
'     rieng link nay (van tracking binh thuong cho cac link chu khac).
'     Danh doi: mat kha nang do click cho link tren anh, doi lay dam bao
'     khong lam vo noi dung mail gui hang loat.
'
' CHANGES vs v4.87
'   - Nguoi dung tu choi danh doi "bo qua tracking cho link boc anh" cua
'     v4.87 vi ve sau mail se can toi 5-10 link (ke ca link tren anh) deu
'     phai tracking duoc. Da xin duoc HTML that cua 1 draft loi (qua tool
'     chan doan tools/ExportDraftHTML.bas) - xac nhan cau truc: <a
'     href="link SharePoint rat dai"><span><img src="cid:..."></span></a>.
'     Do chuoi thu cong (WrapLinks) ban chat de vo voi cau truc nay du da
'     3 lan va luoi an toan.
'   - Doi chien luoc: them RewriteHyperlinksViaWord() - dung THANG API
'     Hyperlinks cua chinh Word (Outlook dung Word lam engine soan thao
'     HTML, MailItem.GetInspector.WordEditor la 1 Word.Document that).
'     Sua .Address cua tung Hyperlink qua Word tu dam bao Word serialize
'     lai dung HTML/VML noi bo cua no - khong con nguy co vo cau truc nhu
'     do chuoi thu cong nua, ke ca link boc anh.
'   - Goi RewriteHyperlinksViaWord() TRUOC khi lay baseHTML = draft.HTMLBody
'     (de baseHTML phan anh dung ban Word da sua). Neu WordEditor khong
'     dung duoc vi ly do nao do (vd may khong dung Word lam trinh soan
'     thao mail mac dinh) -> tu dong lui ve WrapLinks() cu (van giu
'     nguyen loi luoi an toan v4.85/v4.86/v4.87) de khong bao gio mat
'     hoan toan kha nang tracking click.
'
' CHANGES vs v4.88
'   - RewriteHyperlinksViaWord() cua v4.88 GAY LOI NANG HON: test thuc te
'     (kem ca mail "Test" don gian, khong hinh anh) cho ra body TRONG
'     TRON, chi con lai dung chuoi URL tracking hien ra nhu VAN BAN THO.
'     Nguyen nhan rat co the: Word.Hyperlink.Address duoc luu trong FIELD
'     CODE noi bo cua Word (dang { HYPERLINK "..." }) - field code nay co
'     GIOI HAN DO DAI. Link tracking cua ta rat dai (URL SharePoint goc
'     da dai, cong them ma hoa UrlEnc() + toan bo query string campaign/
'     squad/type/eid/rcpt) nen VUOT gioi han, lam Word tu lam hong/xoa
'     field va hien nguyen van dia chi ra thanh chu - te hon ca loi cu
'     (it nhat truoc day van con noi dung, chi rieng 1 link bi bo qua).
'     -> BO HAN RewriteHyperlinksViaWord(), quay lai dung WrapLinks() (do
'     chuoi HTML) lam duy nhat 1 co che, vi no khong bi gioi han do dai
'     nhu Word field.
'   - Sua dung goc re cua van de: xem lai HTML that (tools/ExportDraftHTML.
'     bas) cho thay link SharePoint dang gay loi nam trong cau truc DON
'     GIAN <a href="..."><span><img ...></span></a> - KHONG co VML. Loi
'     TRONG TRON that su (o v4.85/v4.86) chi xay ra voi anh CHU KY dung
'     VML (<v:imagedata>, o:href). WrapLinks() truoc day (v4.87) lai bo
'     qua CA HAI truong hop (VML lan <img> thuong) mot cach qua tay -
'     khien banner/anh thuong (nhu SharePoint o day) khong duoc tracking
'     du an toan de xu ly. Sua: CHI bo qua khi thay dau hieu VML that su
'     (v:imagedata) - anh <img> thuong (banner, logo gan link binh
'     thuong) gio duoc tracking nhu link chu, vi thay the gia tri href
'     don gian trong the <a> KHONG dung gi den cau truc VML de gay vo.
' ================================================================

' CHANGES vs v4.89
'   - Sau khi doi sang WrapLinks() thuan chuoi (bo Word API), test thuc te
'     VAN CON gap lai dung hien tuong TRONG TRON - nghia la 2 gia thuyet
'     lien tiep (VML cua Word / gioi han field cua Word) DEU CHUA DUNG
'     GOC RE that su, chi dang doan mo hinh dua tren suy luan giay tu chu
'     KHONG co bang chung HTML thuc te tai chinh thoi diem loi xay ra.
'   - Thay vi tiep tuc sua theo suy doan, them DebugDumpHTML(): tu dong
'     ghi lai HTML THAT ra file ngay trong luc gui (khong can macro rieng
'     tools/ExportDraftHTML.bas nhu truoc, khong can nguoi dung tu chay
'     them buoc nao) - ghi 3 moc: (1) HTML goc truoc khi WrapLinks dong
'     vao, (2) HTML SAU KHI WrapLinks xu ly xong (truoc khi tach rieng
'     cho tung nguoi nhan), (3) HTML CUOI CUNG thuc su duoc gan vao
'     m.HTMLBody cho nguoi nhan DAU TIEN (sau ca FixInlineImageCids) -
'     tuc la ĐÚNG những gì Outlook thực sự gửi đi. Chỉ ghi khi bật Click
'     Tracking va chi cho nguoi nhan dau tien, tranh sinh file khong lo.
'   - Dung FileSystemObject.CreateTextFile(Unicode:=True) thay vi "Open
'     ... For Output"/"Print #" cu - tranh luon loi ANSI lam sai dau
'     tieng Viet trong file log (da phat hien o ExportDraftHTML.bas).
'   - Muc tieu: lan test toi, chi can mo 3 file trong C:\SHBTrackerLogs\
'     (wraplinks-debug-00-goc-truoc-wrap.txt, -01-sau-wraplinks.txt,
'     -02-cuoi-cung-nguoi-nhan-dau.txt) va gui lai ca 3 - se biet CHINH
'     XAC buoc nao lam noi dung bien mat, thay vi tiep tuc doan.
' ================================================================

Private Const TRACK_URL As String = "https://service.dev-saha.aws.shb.com.vn/public-api/api/track"
Private Const VER       As String = "4.90"
Private Const PH_EID    As String = "[[XEID9F2A]]"
Private Const PH_RCPT   As String = "[[XRCP7B4C]]"

Private m_Bag(0 To 399) As Object
Private m_BagN           As Long

' Giu song bien watcher trong suot phien Outlook (xem RecallNotifWatcher.cls)
' Mot watcher RIENG cho MOI account (khong chi 1 watcher cho account mac
' dinh nhu truoc) - vi thong bao "Message Recall Success/Failure" bay ve
' Inbox cua DUNG account da recall, khong phai luon la account mac dinh.
Private m_RecallWatchers As Collection

' ================================================================
' WINDOWS TIMER - chay ngam HOAN TOAN de tu dong rut gon Sent Items sau
' khi gui, KHONG can bam RecallCampaign(), KHONG hien popup, KHONG chan
' (block) SendCampaign. Day la cach DUY NHAT dap ung dung yeu cau "gui
' xong la tu rut gon" ke ca voi 1 mail (Exchange van can vai phut de mail
' "chot", nhung nguoi dung khong phai cho hay bam gi ca - Outlook tu goi
' lai ham rut gon o "hau truong" qua co che Timer chuan cua Windows).
' ================================================================
#If VBA7 Then
    Private Declare PtrSafe Function SetTimer Lib "user32" _
        (ByVal hwnd As LongPtr, ByVal nIDEvent As LongPtr, ByVal uElapse As Long, ByVal lpTimerFunc As LongPtr) As LongPtr
    Private Declare PtrSafe Function KillTimer Lib "user32" _
        (ByVal hwnd As LongPtr, ByVal nIDEvent As LongPtr) As Long
#Else
    Private Declare Function SetTimer Lib "user32" _
        (ByVal hwnd As Long, ByVal nIDEvent As Long, ByVal uElapse As Long, ByVal lpTimerFunc As Long) As Long
    Private Declare Function KillTimer Lib "user32" _
        (ByVal hwnd As Long, ByVal nIDEvent As Long) As Long
#End If

Private Const SHRINK_TIMER_ID As Long = 918273
Private Const SHRINK_TIMER_INTERVAL_MS As Long = 60000    ' kiem tra lai moi 60 giay
Private Const SHRINK_TIMER_MAX_ATTEMPTS As Long = 12       ' toi da 12 phut

Private m_ShrinkTimerOn As Boolean
Private m_ShrinkSlug As String
Private m_ShrinkTarget As Long      ' so mail can rut gon (sentOK cua campaign)
Private m_ShrinkAttempts As Long

' Bat dau (hoac gia han) timer ngam de tiep tuc thu rut gon slug nay sau
' moi 60 giay, toi da 12 lan, cho den khi du (shrunk >= target) hoac het
' luot thu. Chi theo doi 1 campaign "dang cho" tai 1 thoi diem - neu gui
' campaign MOI trong luc campaign truoc chua rut gon xong, thu rut gon
' campaign cu them 1 lan NGAY tai day truoc khi chuyen sang theo doi
' campaign moi (khong bo do dang nhu truoc).
Private Sub StartShrinkTimer(slug As String, target As Long)
    On Error Resume Next
    If m_ShrinkTimerOn Then
        KillTimer 0, SHRINK_TIMER_ID
        m_ShrinkTimerOn = False
        ' Campaign cu con dang cho -> vet not 1 lan de khong bi bo quen
        ' (thuong da du thoi gian "chot" neu campaign moi gui sau vai phut).
        If Len(Trim(m_ShrinkSlug)) > 0 And m_ShrinkSlug <> slug Then
            Dim dummyDiag As String
            ShrinkCampaignSentItems m_ShrinkSlug, dummyDiag
        End If
    End If
    m_ShrinkSlug = slug
    m_ShrinkTarget = target
    m_ShrinkAttempts = 0
#If VBA7 Then
    Dim h As LongPtr
#Else
    Dim h As Long
#End If
    h = SetTimer(0, SHRINK_TIMER_ID, SHRINK_TIMER_INTERVAL_MS, AddressOf ShrinkTimerProc)
    m_ShrinkTimerOn = (h <> 0)
    On Error GoTo 0
End Sub

' Luon goi KillTimer VO DIEU KIEN (khong phu thuoc co m_ShrinkTimerOn) -
' vi khi VBA project bi reset, co nay bi xoa ve False trong khi timer cua
' Windows VAN CON SONG; neu kiem tra co truoc thi se khong bao gio tat duoc
' timer "mo coi" do. KillTimer voi ID khong ton tai la vo hai.
Private Sub StopShrinkTimer()
    On Error Resume Next
    KillTimer 0, SHRINK_TIMER_ID
    m_ShrinkTimerOn = False
    On Error GoTo 0
End Sub

' Ham callback Windows goi lai moi khi Timer "no" - PHAI la Public Sub trong
' 1 standard module (khong duoc dat trong Class Module) de AddressOf hoat
' dong dung. Chay hoan toan ngam, khong hien gi ca tru khi that su xong.
#If VBA7 Then
Public Sub ShrinkTimerProc(ByVal hwnd As LongPtr, ByVal uMsg As Long, ByVal nIDEvent As LongPtr, ByVal dwTimer As Long)
#Else
Public Sub ShrinkTimerProc(ByVal hwnd As Long, ByVal uMsg As Long, ByVal nIDEvent As Long, ByVal dwTimer As Long)
#End If
    On Error Resume Next

    ' AN TOAN: bien module-level cua VBA bi xoa trang moi khi VBA project
    ' reset (loi chua bat, nguoi dung sua code, Outlook reset...) NHUNG timer
    ' cua Windows thi van tiep tuc "no". Neu gap trang thai do (khong con
    ' slug de xu ly), tat timer ngay - tranh chay vo han vo ich.
    If Len(Trim(m_ShrinkSlug)) = 0 Then
        StopShrinkTimer
        Exit Sub
    End If

    m_ShrinkAttempts = m_ShrinkAttempts + 1

    Dim diag As String: diag = ""
    Dim shrunk As Long: shrunk = ShrinkCampaignSentItems(m_ShrinkSlug, diag)

    If shrunk >= m_ShrinkTarget Or m_ShrinkAttempts >= SHRINK_TIMER_MAX_ATTEMPTS Then
        StopShrinkTimer
    End If
    On Error GoTo 0
End Sub

' ================================================================
' PUBLIC: SendCampaign
' ================================================================
' Tim dong VAN BAN THUC SU dau tien trong noi dung mail, bo qua cac
' dong trong hoac chi la 1 link tran (http/https) - dung de tu dong
' chon preview text, tranh nhet link "tho" vao preheader an.
Private Function FindFirstNonLinkLine(ByVal bodyText As String) As String
    Dim norm As String
    norm = Replace(bodyText, vbCrLf, vbLf)
    norm = Replace(norm, vbCr, vbLf)
    Dim lines() As String: lines = Split(norm, vbLf)
    Dim k As Long
    For k = 0 To UBound(lines)
        Dim ln As String: ln = Trim(lines(k))
        If Len(ln) > 0 Then
            If LCase(Left(ln, 7)) <> "http://" And LCase(Left(ln, 8)) <> "https://" Then
                FindFirstNonLinkLine = ln
                Exit Function
            End If
        End If
    Next k
    FindFirstNonLinkLine = ""
End Function

Public Sub SendCampaign()

    Dim insp As Object
    Set insp = Application.ActiveInspector
    If insp Is Nothing Then
        MsgBox "Mo cua so email truoc khi gui.", vbExclamation, "SHB Tracker v" & VER
        Exit Sub
    End If

    Dim raw As Object
    On Error Resume Next
    Set raw = insp.CurrentItem
    On Error GoTo 0

    If raw Is Nothing Or raw.Class <> olMail Then
        MsgBox "Khong tim thay email dang soan.", vbExclamation, "SHB Tracker v" & VER
        Exit Sub
    End If
    Dim draft As MailItem: Set draft = raw

    ' Campaign metadata via InputBox
    Dim campName As String, squad As String, mType As String, prevTxt As String

    campName = InputBox("Ten chien dich (ASCII, vd: dao-tao-q3-2026):", _
                        "SHB Tracker 1/4", Trim(draft.subject))
    If Len(Trim(campName)) = 0 Then Exit Sub
    campName = Trim(campName)

    squad = InputBox("Squad / Du an (vd: nhan-su, cong-nghe):", _
                     "SHB Tracker 2/4", "default")
    If Len(Trim(squad)) = 0 Then squad = "default"
    squad = Trim(squad)

    mType = InputBox("Loai email (info / alert / training / policy):", _
                     "SHB Tracker 3/4", "info")
    If Len(Trim(mType)) = 0 Then mType = "info"
    mType = Trim(mType)

    ' Preview text: goi y san bang dong dau tien CO CHU THUC SU cua email
    ' body (bo qua dong chi la 1 link tran http/https, xem FindFirstNon-
    ' LinkLine - tranh link "tho" lot vao preview). De trong o InputBox
    ' se dung nguyen goi y nay (giong cach Outlook tu lam mac dinh). Neu
    ' muon tu go de, chi nen go TIENG ANH/ASCII o day - VBA InputBox bi
    ' loi mat mot so ky tu tieng Viet mo rong (vd "ỏ" -> "?", do chuyen
    ' qua ANSI Windows-1258 truoc khi tra ve), khong lien quan gi den
    ' code cua macro nay ma la gioi han co that cua InputBox.
    Dim suggestedPrev As String
    suggestedPrev = FindFirstNonLinkLine(draft.body)
    prevTxt = InputBox("Preview text (doan chu xam hien duoi Subject trong Inbox nguoi nhan)." & vbCrLf & _
                       "De trong se tu dong dung goi y ben duoi (lay tu noi dung mail)." & vbCrLf & _
                       "Neu tu go, nen go TIENG ANH de tranh loi InputBox mat dau tieng Viet:", _
                       "SHB Tracker - Preview text", suggestedPrev)
    prevTxt = Trim(prevTxt)
    If Len(prevTxt) = 0 Then prevTxt = suggestedPrev
    If Len(prevTxt) > 120 Then prevTxt = Left(prevTxt, 120)
    If Len(prevTxt) = 0 Then prevTxt = "(trong)"

    Dim slug As String: slug = MakeSlug(campName)

    Dim mAns As Integer
    mAns = MsgBox("Chon che do gui:" & vbCrLf & vbCrLf & _
                  "YES = Day du (ca nhan) - 1 email/nguoi" & vbCrLf & _
                  "NO  = Nhanh - 1 email toi toan bo nhom", _
                  vbYesNoCancel + vbQuestion, "SHB Tracker v" & VER)
    If mAns = vbCancel Then Exit Sub
    Dim fullMode As Boolean: fullMode = (mAns = vbYes)

    Dim doClick As Boolean
    doClick = (MsgBox("Bat click tracking?", vbYesNo + vbQuestion, "SHB Tracker") = vbYes)

    Dim eid0 As String
    eid0 = Format(Now, "yyMMddHHmm") & Format((CLng(Timer * 100) Mod 9000) + 1000, "0000")

    Dim modeStr As String
    If fullMode Then
        modeStr = "Day du (ca nhan) - 1 email/nguoi"
    Else
        modeStr = "Nhanh - 1 email toi nhom"
    End If

    Dim cm As String
    cm = "XAC NHAN GUI CHIEN DICH" & vbCrLf & String(32, "-") & vbCrLf & _
         "Che do      : " & modeStr & vbCrLf & _
         "Chien dich  : " & campName & vbCrLf & _
         "Slug (DB)   : " & slug & vbCrLf & _
         "Squad/Du an : " & squad & vbCrLf & _
         "Loai        : " & mType & vbCrLf & _
         "Preview text: " & Left(prevTxt, 60) & vbCrLf & _
         "Click track : " & IIf(doClick, "Bat", "Tat") & vbCrLf & _
         String(32, "-") & vbCrLf & "Tiep tuc?"
    If MsgBox(cm, vbYesNo + vbQuestion, "SHB Tracker") = vbNo Then Exit Sub

    m_BagN = 0
    If fullMode Then
        DoFullMode draft, campName, slug, squad, mType, eid0, doClick, prevTxt
    Else
        DoFastMode draft, slug, squad, mType, eid0
    End If
End Sub


' ================================================================
' SAVE/LOAD CAMPAIGN INFO - de RecallCampaign() tim mail NGAY duoc, khong
' can doi UserProperty CMSlug on dinh (xem ghi chu tai noi goi).
' ================================================================
' QUAN TRONG: SaveSetting/GetSetting (Windows Registry) chi luu duoc chuoi
' ANSI/ASCII co ban - cac ky tu tieng Viet co dau se bi hong thanh
' "?" khi luu, lam Subject doc lai KHONG con khop voi Subject that trong
' Sent Items. De tranh mat du lieu, ma hoa Subject sang HEX (chi gom 0-9/A-F,
' an toan tuyet doi voi moi ky tu Unicode) truoc khi SaveSetting, giai ma lai
' luc GetSetting - xem Utf8ToHex/HexToUtf8 ben duoi.
Private Sub SaveCampaignInfo(slug As String, subj As String, tStart As Date, tEnd As Date)
    On Error Resume Next
    SaveSetting "SHBTracker", "Campaigns", slug, Utf8ToHex(subj) & "|" & CDbl(tStart) & "|" & CDbl(tEnd)
    On Error GoTo 0
End Sub

Private Function LoadCampaignInfo(slug As String, ByRef subj As String, _
                                   ByRef tStart As Date, ByRef tEnd As Date) As Boolean
    On Error Resume Next
    Dim raw As String: raw = GetSetting("SHBTracker", "Campaigns", slug, "")
    If Len(raw) = 0 Then
        LoadCampaignInfo = False
        Exit Function
    End If
    Dim parts() As String: parts = Split(raw, "|")
    If UBound(parts) < 2 Then
        LoadCampaignInfo = False
        Exit Function
    End If
    subj = HexToUtf8(parts(0))
    tStart = CDate(CDbl(parts(1)))
    tEnd = CDate(CDbl(parts(2)))
    LoadCampaignInfo = (Err.Number = 0)
    On Error GoTo 0
End Function

' Ma hoa chuoi Unicode sang chuoi HEX ASCII an toan (dung UTF-8 byte, giong
' co che UrlEnc() da co san trong file nay) - de luu qua SaveSetting khong
' bi mat ky tu co dau.
Private Function Utf8ToHex(s As String) As String
    If Len(s) = 0 Then Utf8ToHex = "": Exit Function
    On Error GoTo FallbackHex

    Dim stm As Object: Set stm = CreateObject("ADODB.Stream")
    stm.Open
    stm.Type = 2: stm.Charset = "UTF-8"
    stm.WriteText s
    stm.Position = 0
    stm.Type = 1
    Dim rawB() As Byte: rawB = stm.Read
    stm.Close: Set stm = Nothing

    Dim bStart As Long: bStart = 0
    If UBound(rawB) >= 2 Then
        If rawB(0) = 239 And rawB(1) = 187 And rawB(2) = 191 Then bStart = 3
    End If

    Dim r As String: r = ""
    Dim bi As Long
    For bi = bStart To UBound(rawB)
        r = r & Right("0" & Hex(rawB(bi)), 2)
    Next bi
    Utf8ToHex = r
    Exit Function

FallbackHex:
    On Error GoTo 0
    Utf8ToHex = ""
End Function

Private Function HexToUtf8(h As String) As String
    If Len(h) = 0 Then HexToUtf8 = "": Exit Function
    On Error GoTo FallbackDec

    Dim stm As Object: Set stm = CreateObject("ADODB.Stream")
    stm.Open
    stm.Type = 1

    Dim i As Long
    For i = 1 To Len(h) Step 2
        Dim b As Byte: b = CByte("&H" & mid(h, i, 2))
        stm.Write CByteArray(b)
    Next i

    stm.Position = 0
    stm.Type = 2: stm.Charset = "UTF-8"
    HexToUtf8 = stm.ReadText
    stm.Close: Set stm = Nothing
    Exit Function

FallbackDec:
    On Error GoTo 0
    HexToUtf8 = ""
End Function

' ADODB.Stream.Write can 1 mang Byte, khong nhan truc tiep 1 gia tri Byte don.
Private Function CByteArray(b As Byte) As Variant
    Dim arr(0) As Byte: arr(0) = b
    CByteArray = arr
End Function


' ================================================================
' FULL MODE
' ================================================================
Private Sub DoFullMode(draft As MailItem, campName As String, slug As String, _
                        squad As String, mType As String, eid0 As String, _
                        doClick As Boolean, prevTxt As String)

    ' Ghi lai thoi diem bat dau gui + Subject goc (KHONG doi trong suot vong
    ' lap - chi doi HTMLBody/Recipients cho tung nguoi) - de RecallCampaign()
    ' sau nay co the tim mail NGAY bang Subject + khoang thoi gian, khong can
    ' doi UserProperty CMSlug on dinh (xem SaveCampaignInfo/LoadCampaignInfo).
    Dim campStart As Date: campStart = Now
    Dim origSubject As String: origSubject = draft.subject

    Dim lst() As String: ReDim lst(0 To 4999)
    Dim nLst As Long: nLst = 0

    Dim rcp As Recipient
    Dim diag As String: diag = ""
    For Each rcp In draft.Recipients
        Dim before As Long: before = nLst
        ExpandEntry rcp.AddressEntry, lst, nLst
        If nLst = before Then
            ' Recipient nay khong resolve duoc SMTP -> ghi lai de chan doan
            Dim tInfo As String: tInfo = "?"
            On Error Resume Next
            tInfo = "type=" & rcp.AddressEntry.AddressEntryUserType & " | addr=" & Left(rcp.AddressEntry.Address, 60)
            On Error GoTo 0
            diag = diag & vbCrLf & "  - " & rcp.Name & "  [" & tInfo & "]"
        End If
    Next rcp

    If nLst = 0 Then
        MsgBox "Khong tim thay dia chi email hop le." & vbCrLf & vbCrLf & _
               "Nguoi nhan khong lay duoc SMTP:" & diag, vbExclamation, "SHB Tracker"
        Exit Sub
    End If

    ' Ghi lai Content-ID GOC cua tung file dinh kem (anh nhung - inline
    ' image) trong draft, THEO THU TU - de sau nay so sanh voi Content-ID
    ' cua ban Copy() tuong ung (xem FixInlineImageCids). Outlook co the
    ' TU SINH Content-ID MOI cho anh nhung khi Copy() 1 MailItem, khien
    ' chuoi "cid:..." cu con trong HTMLBody khong con khop - day la
    ' nguyen nhan anh nhung (chen qua Insert > Pictures) bi "vo" (khong
    ' hien) o nguoi nhan, du gui thanh cong.
    Dim origCids() As String
    Dim origCidCount As Long: origCidCount = draft.Attachments.Count
    If origCidCount > 0 Then
        ReDim origCids(1 To origCidCount)
        Dim ci As Long
        For ci = 1 To origCidCount
            origCids(ci) = GetAttachmentCid(draft.Attachments(ci))
        Next ci
    End If

    Dim baseHTML As String: baseHTML = draft.HTMLBody
    If doClick Then DebugDumpHTML "00-goc-truoc-wrap", baseHTML

    ' Inject preview text as hidden preheader
    If Len(prevTxt) > 0 And prevTxt <> "(trong)" Then
        Dim preHdr As String
        preHdr = "<div style=""display:none;max-height:0;overflow:hidden;mso-hide:all;" & _
                 "font-size:1px;color:#ffffff;line-height:1px;"">" & prevTxt & "</div>"
        Dim btPos As Long: btPos = InStr(LCase(baseHTML), "<body")
        If btPos > 0 Then
            Dim btEnd As Long: btEnd = InStr(btPos, baseHTML, ">")
            If btEnd > 0 Then
                baseHTML = Left(baseHTML, btEnd) & preHdr & mid(baseHTML, btEnd + 1)
            End If
        Else
            baseHTML = preHdr & baseHTML
        End If
    End If

    If doClick Then
        baseHTML = WrapLinks(baseHTML, slug, squad, mType)
        DebugDumpHTML "01-sau-wraplinks", baseHTML
    End If

    Dim sentOK As Long:   sentOK = 0
    Dim sentFail As Long: sentFail = 0
    Dim failDiag As String: failDiag = ""
    Const BATCH As Long = 50
    Const SHRINK_EVERY As Long = 100

    Dim i As Long
    For i = 0 To nLst - 1
        ' Parse combined entry: smtp~role~dept~loc
        Dim entry() As String: entry = Split(lst(i), "~")
        Dim rcpt As String: rcpt = entry(0)
        If Len(rcpt) = 0 Then GoTo NextPerson
        Dim eRole As String: eRole = IIf(UBound(entry) >= 1, entry(1), "")
        Dim eDept As String: eDept = IIf(UBound(entry) >= 2, entry(2), "")
        Dim eLoc  As String: eLoc = IIf(UBound(entry) >= 3, entry(3), "")

        Dim eid As String: eid = eid0 & Format(i, "0000")

        Dim pxURL As String
        pxURL = TRACK_URL & "?pos=top" & _
                "&eid=" & eid & _
                "&rcpt=" & UrlEnc(rcpt) & _
                "&campaign=" & UrlEnc(slug) & _
                "&squad=" & UrlEnc(squad) & _
                "&type=" & UrlEnc(mType) & _
                "&role=" & UrlEnc(eRole) & _
                "&dept=" & UrlEnc(eDept) & _
                "&loc=" & UrlEnc(eLoc)
        Dim pxTag As String
        pxTag = "<img src=" & Chr(34) & pxURL & Chr(34) & _
                " width=" & Chr(34) & "1" & Chr(34) & _
                " height=" & Chr(34) & "1" & Chr(34) & _
                " style=" & Chr(34) & "display:none" & Chr(34) & _
                " border=" & Chr(34) & "0" & Chr(34) & _
                " alt=" & Chr(34) & Chr(34) & "/>"

        Dim thisHTML As String: thisHTML = baseHTML
        If doClick Then
            thisHTML = Replace(thisHTML, PH_EID, eid)
            thisHTML = Replace(thisHTML, PH_RCPT, UrlEnc(rcpt))
        End If
        Dim bp As Long: bp = InStr(LCase(thisHTML), "</body>")
        If bp > 0 Then
            thisHTML = Left(thisHTML, bp - 1) & pxTag & mid(thisHTML, bp)
        Else
            thisHTML = thisHTML & pxTag
        End If

        Dim m As MailItem
        On Error GoTo FailItem

        Set m = draft.Copy

        Dim j As Long
        For j = m.Recipients.Count To 1 Step -1
            m.Recipients.Item(j).Delete
        Next j

        m.Recipients.Add rcpt

        ' Sua lai "cid:..." trong HTML neu Outlook da sinh Content-ID MOI
        ' cho anh nhung trong ban Copy() nay (xem ghi chu tai origCids o tren).
        If origCidCount > 0 Then FixInlineImageCids m, thisHTML, origCids

        If doClick And i = 0 Then DebugDumpHTML "02-cuoi-cung-nguoi-nhan-dau", thisHTML

        m.HTMLBody = thisHTML

        ' Tag campaign info truc tiep vao mail de RecallCampaign() loc lai duoc sau nay
        m.UserProperties.Add "CMSlug", olText
        m.UserProperties("CMSlug").Value = slug
        m.UserProperties.Add "CMEID", olText
        m.UserProperties("CMEID").Value = eid

        m.DeleteAfterSubmit = False
        m.send
        sentOK = sentOK + 1
        Set m = Nothing

        On Error GoTo 0

        ' pos=sent: async fire-and-forget
        FireHttp TRACK_URL & "?pos=sent" & _
                 "&eid=" & eid & _
                 "&rcpt=" & UrlEnc(rcpt) & _
                 "&campaign=" & UrlEnc(slug) & _
                 "&squad=" & UrlEnc(squad) & _
                 "&type=" & UrlEnc(mType) & _
                 "&role=" & UrlEnc(eRole) & _
                 "&dept=" & UrlEnc(eDept) & _
                 "&loc=" & UrlEnc(eLoc)

        DoEvents

        If (i + 1) Mod BATCH = 0 And i < nLst - 1 Then
            Dim tEnd As Date: tEnd = Now + TimeSerial(0, 0, 2)
            Do While Now < tEnd: DoEvents: Loop
        End If

        ' Rut gon DINH KY (khong phai chi 1 lan luc cuoi) - de hop thu khong
        ' phinh to het 3000-3500 mail roi moi xep lai o cuoi. Cach nhau
        ' SHRINK_EVERY mail (khong phai tung mail mot) de item da gui truoc do
        ' du "on dinh" trong Sent Items, tranh loi sua MailItem ngay sau .send().
        If (i + 1) Mod SHRINK_EVERY = 0 And i < nLst - 1 Then
            ShrinkCampaignSentItems slug
        End If

        GoTo NextPerson

FailItem:
        sentFail = sentFail + 1
        If Len(failDiag) < 1000 Then
            failDiag = failDiag & vbCrLf & "  - " & rcpt & ": #" & Err.Number & " " & Err.Description
        End If
        On Error Resume Next
        If Not m Is Nothing Then m.Delete
        Set m = Nothing
        On Error GoTo 0
        Resume NextPerson

NextPerson:
    Next i

    ' Flush: wait 3s for async HTTP requests to complete
    Dim flushEnd As Date: flushEnd = Now + TimeSerial(0, 0, 3)
    Do While Now < flushEnd: DoEvents: Loop

    ' Luu lai Subject + khoang thoi gian gui campaign nay - de RecallCampaign()
    ' co the tim mail NGAY (Subject/SentOn la thuoc tinh goc, doc duoc tuc thi,
    ' khac voi UserProperty CMSlug can vai phut moi doc on dinh duoc).
    SaveCampaignInfo slug, origSubject, campStart, Now

    ' Thu rut gon NGAY 1 lan (bat duoc phan da "chot" - thuong la mail gui
    ' som trong campaign lon nho SHRINK_EVERY o tren). KHONG chan (block)
    ' SendCampaign de cho them - nguoi dung can duoc tra lai quyen dieu
    ' khien ngay (vd de huy gui giua chung trong Outbox neu can).
    Dim shrinkDiag As String: shrinkDiag = ""
    Dim shrunk As Long: shrunk = ShrinkCampaignSentItems(slug, shrinkDiag)

    Dim doneMsg As String
    doneMsg = "Hoan thanh!" & vbCrLf & "Thanh cong: " & sentOK & vbCrLf & "Loi: " & sentFail & _
              vbCrLf & "Da rut gon Sent Items: " & shrunk & " / " & sentOK

    If shrunk < sentOK Then
        ' Bat Windows Timer chay ngam - tu dong thu lai moi 60 giay, toi da
        ' 12 phut, KHONG can nguoi dung bam gi, KHONG hien popup nao them.
        StartShrinkTimer slug, sentOK
        doneMsg = doneMsg & vbCrLf & "(Con " & (sentOK - shrunk) & " mail Exchange chua 'chot' kip - " & _
                  "se TU DONG rut gon ngam trong vai phut toi, khong can lam gi them.)"
    End If
    If sentFail > 0 Then doneMsg = doneMsg & vbCrLf & vbCrLf & "Chi tiet loi:" & failDiag
    MsgBox doneMsg, vbInformation, "SHB Tracker v" & VER
End Sub


' Ghi lai HTML thuc te tai tung buoc xu ly click-tracking ra file log, de
' doi chieu that (khong con phai doan mo hinh WrapLinks() lam gi sai) khi
' co loi. CHI ghi khi doClick=True va CHI cho nguoi nhan dau tien (tranh
' file khong lo voi campaign hang nghin nguoi nhan).
' Dung FileSystemObject.CreateTextFile(..., Unicode:=True) thay vi
' "Open ... For Output"/"Print #" - cach cu ghi theo ANSI (Windows-1258)
' se lam sai dau tieng Viet trong log (da gap voi tools/ExportDraftHTML.
' bas truoc day), gay hieu lam khi doc lai.
Private Sub DebugDumpHTML(tag As String, html As String)
    On Error Resume Next
    Dim fso As Object: Set fso = CreateObject("Scripting.FileSystemObject")
    Dim dirPath As String: dirPath = "C:\SHBTrackerLogs"
    If Not fso.FolderExists(dirPath) Then fso.CreateFolder dirPath
    Dim outPath As String: outPath = dirPath & "\wraplinks-debug-" & tag & ".txt"
    Dim ts As Object: Set ts = fso.CreateTextFile(outPath, True, True) ' overwrite, Unicode
    ts.Write html
    ts.Close
End Sub

' Doc Content-ID (PR_ATTACH_CONTENT_ID) cua 1 file dinh kem - chi anh
' nhung (inline image) moi co gia tri nay, file dinh kem thuong khong co
' nen ham tra ve chuoi rong la binh thuong.
Private Function GetAttachmentCid(att As Attachment) As String
    Dim cid As String: cid = ""
    On Error Resume Next
    cid = att.PropertyAccessor.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x3712001E")
    On Error GoTo 0
    GetAttachmentCid = cid
End Function

' Sau khi draft.Copy(), Outlook co the sinh Content-ID MOI cho tung anh
' nhung trong ban copy (khac voi Content-ID goc con dang tham chieu boi
' chuoi "cid:..." trong html). Doi chieu theo THU TU file dinh kem (Copy()
' giu nguyen thu tu) va thay the cid cu bang cid moi tuong ung ngay trong
' bien html (ByRef) truoc khi gan m.HTMLBody - tranh anh bi "vo" o nguoi
' nhan du gui thanh cong.
Private Sub FixInlineImageCids(m As MailItem, ByRef html As String, origCids() As String)
    On Error Resume Next
    Dim n As Long: n = m.Attachments.Count
    Dim k As Long
    For k = 1 To n
        If k <= UBound(origCids) Then
            If Len(origCids(k)) > 0 Then
                Dim newCid As String
                newCid = GetAttachmentCid(m.Attachments(k))
                If Len(newCid) > 0 And newCid <> origCids(k) Then
                    html = Replace(html, "cid:" & origCids(k), "cid:" & newCid)
                End If
            End If
        End If
    Next k
    On Error GoTo 0
End Sub


' ================================================================
' SHRINK CAMPAIGN SENT ITEMS
' Quet Sent Items, loc theo CMSlug cua campaign vua gui, rut gon body
' cua tung ban luu thanh placeholder ngan (giu nguyen Subject/To/Date va
' 2 tag CMSlug/CMEID de RecallCampaign() van loc/tim dung sau nay).
'
' Nguoi nhan DA nhan ban day du luc gui (m.send o DoFullMode) - rut gon
' o day chi anh huong ban luu cua NGUOI GUI, khong anh huong gi toi noi
' dung nguoi nhan da nhan. Chay SAU khi ca batch da gui xong (khong phai
' ngay tung mail) de tranh loi sua MailItem ngay sau .send().
' ================================================================
' Quet Sent Items cua TAT CA account trong profile (khong chi account mac
' dinh) - GetDefaultFolder(olFolderSentMail) truoc day chi tra ve Sent
' Items cua 1 account MAC DINH duy nhat, nen neu campaign gui tu account
' khac se khong bao gio tim thay. Dedup theo StoreID nhu ArchiveModule.bas.
' Quet 1 folder Sent Items, rut gon cac mail khop slug/Subject+SentOn -
' tach rieng thanh Sub de dung chung cho ca vong lap da-account va
' phan du phong (fallback) trong ShrinkCampaignSentItems() ben duoi.
Private Sub ScanFolderForShrink(fld As folder, slug As String, hasCampInfo As Boolean, _
                                  knownSubject As String, tCampStart As Date, tCampEnd As Date, _
                                  tBuf As Date, placeholderHTML As String, _
                                  ByRef diag As String, ByRef matched As Long, ByRef n As Long, _
                                  ByRef scanned As Long, ByRef sampleDiag As String)
    Dim i As Long
    For i = fld.Items.Count To 1 Step -1
        Dim itm As Object: Set itm = fld.Items(i)
        If TypeName(itm) = "MailItem" Then
            Dim itmSlug As String: itmSlug = "(khong doc duoc)"
            Dim upErr As Long: upErr = 0
            On Error Resume Next
            Err.Clear
            itmSlug = itm.UserProperties("CMSlug").Value
            upErr = Err.Number
            On Error GoTo 0

            Dim isShrinkMatch As Boolean: isShrinkMatch = False
            If itmSlug = slug Then
                isShrinkMatch = True
            ElseIf hasCampInfo Then
                On Error Resume Next
                If itm.subject = knownSubject And _
                   itm.SentOn >= tCampStart - tBuf And _
                   itm.SentOn <= tCampEnd + tBuf Then
                    isShrinkMatch = True
                End If
                On Error GoTo 0
            End If

            If isShrinkMatch Then
                matched = matched + 1
                On Error Resume Next
                Err.Clear
                itm.HTMLBody = placeholderHTML
                itm.Save
                If Err.Number = 0 Then
                    n = n + 1
                Else
                    If Len(diag) < 800 Then
                        diag = diag & vbCrLf & "  - " & itm.subject & ": #" & Err.Number & " " & Err.Description
                    End If
                End If
                On Error GoTo 0
            End If
            ' Chan doan: ghi lai 3 mail gan nhat (bat ke co khop slug hay
            ' khong) de xem gia tri CMSlug thuc su doc duoc la gi.
            If scanned < 3 Then
                scanned = scanned + 1
                If upErr <> 0 Then
                    sampleDiag = sampleDiag & vbCrLf & "  - [" & itm.subject & "] loi doc UserProperty #" & upErr
                Else
                    sampleDiag = sampleDiag & vbCrLf & "  - [" & itm.subject & "] CMSlug doc duoc = '" & itmSlug & "'"
                End If
            End If
        End If
    Next i
End Sub

Public Function ShrinkCampaignSentItems(slug As String, _
                                          Optional ByRef diag As String = "") As Long
    Dim n As Long: n = 0

    Dim placeholder As String
    placeholder = "[Noi dung da duoc rut gon de tiet kiem dung luong hop thu - " & _
                  "email goc da gui thanh cong toi nguoi nhan. Campaign: " & slug & "]"
    Dim placeholderHTML As String
    placeholderHTML = "<html><body style=""font-family:Segoe UI,Arial,sans-serif;" & _
                       "color:#666;font-size:13px;"">" & placeholder & "</body></html>"

    ' Cung cach tim NHANH nhu RecallCampaign() - Subject + khoang thoi gian
    ' gui (thuoc tinh GOC, doc duoc TUC THI) lam dieu kien BO SUNG, khong chi
    ' dua vao CMSlug (co the mat vai phut moi doc duoc). Neu khong co, ham
    ' nay se KHONG BAO GIO bat kip duoc mail moi gui, du goi lai bao nhieu
    ' lan / doi bao lau di nua.
    Dim knownSubject As String, tCampStart As Date, tCampEnd As Date
    Dim hasCampInfo As Boolean
    hasCampInfo = LoadCampaignInfo(slug, knownSubject, tCampStart, tCampEnd)
    Dim tBuf As Date: tBuf = TimeSerial(0, 1, 0)

    Dim matched As Long: matched = 0
    Dim scanned As Long: scanned = 0
    Dim sampleDiag As String: sampleDiag = ""
    Dim accountsScanned As Long: accountsScanned = 0

    Dim seenStoreIDs As String: seenStoreIDs = "|"
    Dim acc As Object, store As Object, sentFolder As folder, storeID As String
    For Each acc In Application.Session.Accounts
        On Error Resume Next
        Set store = Nothing
        Set store = acc.DeliveryStore
        On Error GoTo 0
        If store Is Nothing Then GoTo NextAccount
        storeID = ""
        On Error Resume Next
        storeID = store.StoreID
        On Error GoTo 0
        If Len(storeID) = 0 Or InStr(seenStoreIDs, "|" & storeID & "|") > 0 Then GoTo NextAccount
        seenStoreIDs = seenStoreIDs & storeID & "|"

        Set sentFolder = Nothing
        On Error Resume Next
        Set sentFolder = store.GetDefaultFolder(olFolderSentMail)
        On Error GoTo 0
        If sentFolder Is Nothing Then GoTo NextAccount

        accountsScanned = accountsScanned + 1
        ScanFolderForShrink sentFolder, slug, hasCampInfo, knownSubject, tCampStart, tCampEnd, _
                             tBuf, placeholderHTML, diag, matched, n, scanned, sampleDiag
NextAccount:
    Next acc

    ' Du phong: neu vi ly do nao do khong quet duoc account nao qua vong
    ' lap tren (vd acc.DeliveryStore khong tra ve duoc voi kieu account/
    ' profile nao do), quay lai dung cach cu (v4.68) de KHONG BAO GIO te
    ' hon truoc - GetDefaultFolder luon tra ve it nhat Sent Items cua
    ' account mac dinh.
    If accountsScanned = 0 Then
        Set sentFolder = Nothing
        On Error Resume Next
        Set sentFolder = Application.Session.GetDefaultFolder(olFolderSentMail)
        On Error GoTo 0
        If Not sentFolder Is Nothing Then
            ScanFolderForShrink sentFolder, slug, hasCampInfo, knownSubject, tCampStart, tCampEnd, _
                                 tBuf, placeholderHTML, diag, matched, n, scanned, sampleDiag
        End If
    End If

    If matched = 0 Then
        diag = "(khong tim thay mail nao co CMSlug = '" & slug & "'" & _
               IIf(hasCampInfo, " (co thong tin Subject/thoi gian da luu nhung cung khong khop)", _
                   " (khong co thong tin Subject/thoi gian da luu)") & _
               ". 3 mail gan nhat trong Sent Items:" & sampleDiag & ")"
    End If

    ShrinkCampaignSentItems = n
End Function


' ================================================================
' FAST MODE
' ================================================================
Private Sub DoFastMode(draft As MailItem, slug As String, squad As String, _
                        mType As String, eid0 As String)
    FireHttpSync TRACK_URL & "?pos=sent" & _
                 "&eid=" & eid0 & "0000" & _
                 "&rcpt=" & UrlEnc("dl") & _
                 "&campaign=" & UrlEnc(slug) & _
                 "&squad=" & UrlEnc(squad) & _
                 "&type=" & UrlEnc(mType)

    ' Gan tag CMSlug/CMEID nhu Full Mode - de ArchiveModule.bas (chi doc
    ' UserProperty CMSlug) cung nhan dien va archive duoc mail gui bang
    ' che do Nhanh nay, khong chi rieng Full Mode.
    On Error Resume Next
    draft.UserProperties.Add "CMSlug", olText
    draft.UserProperties("CMSlug").Value = slug
    draft.UserProperties.Add "CMEID", olText
    draft.UserProperties("CMEID").Value = eid0 & "0000"
    On Error GoTo 0

    draft.send
    MsgBox "Da gui (Nhanh).", vbInformation, "SHB Tracker v" & VER
End Sub


' ================================================================
' EXPAND ADDRESS ENTRY
' ================================================================
Private Sub ExpandEntry(ae As AddressEntry, ByRef lst() As String, ByRef n As Long)
    If ae Is Nothing Then Exit Sub
    On Error Resume Next

    If ae.AddressEntryUserType = olExchangeDistributionListAddressEntry Then
        Dim mems As AddressEntries: Set mems = ae.Members
        If Not mems Is Nothing Then
            Dim mem As AddressEntry
            For Each mem In mems
                ExpandEntry mem, lst, n
            Next mem
        End If
    Else
        Dim smtp As String: smtp = ""
        Dim dispName As String: dispName = ae.Name
        Dim xu As ExchangeUser: Set xu = ae.GetExchangeUser()
        If Not xu Is Nothing Then
            smtp = xu.PrimarySmtpAddress
            If Len(Trim(dispName)) = 0 Then dispName = xu.Name
        ElseIf ae.AddressEntryUserType = olSmtpAddressEntry Then
            smtp = ae.Address
        End If
        ' Fallback 1: PR_SMTP_ADDRESS qua PropertyAccessor (GAL / hau het entry Exchange)
        If InStr(smtp, "@") = 0 Then
            smtp = ""
            smtp = ae.PropertyAccessor.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x39FE001E")
        End If
        ' Fallback 1b: PR_EMAIL_ADDRESS (one-off / contact doi khi chua SMTP o day)
        If InStr(smtp, "@") = 0 Then
            Dim e2 As String: e2 = ""
            e2 = ae.PropertyAccessor.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x3003001E")
            If InStr(e2, "@") > 0 Then smtp = e2
        End If
        ' Fallback 2: Contact ca nhan -> Email1Address
        If InStr(smtp, "@") = 0 Then
            Dim ct As Object: Set ct = Nothing
            Set ct = ae.GetContact()
            If Not ct Is Nothing Then smtp = ct.Email1Address
        End If
        ' Fallback 3: ae.Address neu ban than da la SMTP
        If InStr(smtp, "@") = 0 Then
            If InStr(ae.Address, "@") > 0 Then smtp = ae.Address
        End If
        smtp = LCase(Trim(smtp))
        If Len(smtp) > 5 And InStr(smtp, "@") > 0 Then
            ' Dedup by SMTP
            Dim k As Long
            For k = 0 To n - 1
                If Split(lst(k), "~")(0) = smtp Then GoTo AlreadyIn
            Next k
            If n > UBound(lst) Then ReDim Preserve lst(0 To n + 999)
            ' Parse display name: "Ten (Role - Dept - Loc)"
            Dim role As String: role = ""
            Dim dept As String: dept = ""
            Dim loc  As String: loc = ""
            Dim p1 As Long: p1 = InStr(dispName, "(")
            Dim p2 As Long: p2 = InStr(dispName, ")")
            If p1 > 0 And p2 > p1 Then
                Dim inner As String: inner = Trim(mid(dispName, p1 + 1, p2 - p1 - 1))
                inner = Replace(inner, " " & Chr(8211) & " ", " - ")
                Dim parts() As String: parts = Split(inner, " - ", 3)
                If UBound(parts) >= 0 Then role = Trim(parts(0))
                If UBound(parts) >= 1 Then dept = Trim(parts(1))
                If UBound(parts) >= 2 Then loc = Trim(parts(2))
            End If
            ' Store as "smtp~role~dept~loc"
            lst(n) = smtp & "~" & role & "~" & dept & "~" & loc
            n = n + 1
        End If
    End If

AlreadyIn:
    On Error GoTo 0
End Sub


' ================================================================
' WRAP LINKS
' ================================================================
' QUAN TRONG: day KHONG PHAI 1 trinh phan tich HTML that su, chi la do
' chuoi thu cong tim "href=" ... " ke tiep - voi HTML phuc tap (vd Outlook
' dung engine Word de dung HTML, chu ky co anh gan link, VML, style co
' dau nhay long nhau...) co the bat NHAM dau " dong sai vi tri, khien
' "orig" nuot ca mot doan lon HTML that (bao gom ca anh/chu ky) roi XOA
' mat doan do khi ghep lai res = Left(...) & tURL & mid(...) - lam mail
' nhan duoc TRONG TRON, mat het anh/chu ky (da gap thuc te). Them 2 lop
' phong ve:
'   1. Neu doan "orig" bat duoc chua ky tu "<" (dau hieu quet lan sang
'      tag khac, khong con la 1 gia tri href hop le) hoac dai bat thuong
'      (>2000 ky tu) -> BO QUA doan nay (khong wrap), tiep tuc quet tiep,
'      khong lam gi voi doan nghi ngo do de tranh xoa nham.
'   2. Sau khi quet xong TOAN BO, WrapLinks() chi co the LAM DAI THEM
'      chuoi (thay href goc bang link tracking dai hon), khong bao gio
'      lam NGAN hon duoc mot cach hop le. Neu ket qua cuoi cung ngan hon
'      chuoi goc -> chac chan co loi quet dau, HUY BO toan bo thay doi,
'      tra ve NGUYEN VAN html goc (thap chi khong wrap link con hon la
'      gui mail trong tron cho hang loat nguoi nhan).
Private Function WrapLinks(html As String, slug As String, _
                             squad As String, mType As String) As String
    Dim res As String: res = html
    Dim pos As Long:   pos = 1

    Do
        Dim rawHs As Long: rawHs = InStr(pos, LCase(res), "href=" & Chr(34))
        If rawHs = 0 Then Exit Do

        ' Chi bat dung thuoc tinh "href=" DOC LAP (dung sau khoang trang/
        ' dau tag) - BO QUA neu la hau to cua thuoc tinh khac nhu "o:href="
        ' hoac "xlink:href=" (thuoc tinh noi bo cua VML/Word dung de ve
        ' anh/shape trong chu ky phuc tap - KHONG PHAI link nguoi dung).
        ' Ghi de nham thuoc tinh nay bang link tracking khong lam ngan
        ' chuoi (nen luoi an toan do dai o duoi khong bat duoc) nhung co
        ' the pha vo cau truc VML, khien Word engine cua Outlook render
        ' ra TRONG TRON o phia nguoi nhan.
        If rawHs > 1 Then
            Dim chBefore As String: chBefore = mid(res, rawHs - 1, 1)
            If chBefore <> " " And chBefore <> vbTab And chBefore <> vbCr And chBefore <> vbLf Then
                pos = rawHs + 5
                GoTo ContinueLoop
            End If
        End If

        Dim hs As Long: hs = rawHs + 6
        Dim he As Long: he = InStr(hs, res, Chr(34))
        If he = 0 Then Exit Do
        Dim orig As String: orig = mid(res, hs, he - hs)

        ' Link nay co dang boc quanh cau truc VML phuc tap khong (chu ky
        ' Outlook thuong ve anh bang <v:shape>/<v:imagedata> + conditional
        ' comment lien ket voi nhau, rat de vo neu ghi de href That dai
        ' vao giua)? CHI bo qua khi thay ro dau hieu VML that su
        ' (v:imagedata) - anh thuong (<img> don gian, vd banner chen qua
        ' Insert > Pictures roi gan Hyperlink, KHONG co VML) van duoc xu
        ' ly binh thuong nhu link chu, vi day chi la thay gia tri thuoc
        ' tinh href don gian, khong dung gi den cau truc VML de vo.
        Dim peekAhead As String: peekAhead = LCase(mid(res, he, 800))
        Dim posVmlTag As Long: posVmlTag = InStr(peekAhead, "v:imagedata")
        Dim posCloseA As Long: posCloseA = InStr(peekAhead, "</a>")
        Dim isImageLink As Boolean: isImageLink = False
        If posVmlTag > 0 And (posCloseA = 0 Or posVmlTag < posCloseA) Then isImageLink = True

        ' Nghi ngo quet nham (nuot qua tag khac hoac dai bat thuong) ->
        ' bo qua, khong dong gi vao doan nay, tiep tuc quet tu sau dau
        ' " vua tim thay.
        If isImageLink Then
            pos = he + 1
        ElseIf InStr(orig, "<") > 0 Or Len(orig) > 2000 Then
            pos = he + 1
        ElseIf Left(LCase(orig), 4) <> "http" Or InStr(LCase(orig), "api/track") > 0 Then
            pos = he + 1
        Else
            If Len(orig) > 480 Then orig = Left(orig, 480)
            Dim tURL As String
            tURL = TRACK_URL & "?pos=click" & _
                   "&eid=" & PH_EID & _
                   "&rcpt=" & PH_RCPT & _
                   "&campaign=" & UrlEnc(slug) & _
                   "&squad=" & UrlEnc(squad) & _
                   "&type=" & UrlEnc(mType) & _
                   "&url=" & UrlEnc(orig)
            res = Left(res, hs - 1) & tURL & mid(res, he)
            pos = hs + Len(tURL) + 1
        End If
ContinueLoop:
    Loop

    ' Luoi an toan cuoi cung: WrapLinks chi co the LAM DAI chuoi, khong
    ' bao gio lam ngan hop le duoc. Neu ket qua ngan hon ban goc, chac
    ' chan co doan da bi xoa nham - huy toan bo, tra ve nguyen ban goc.
    If Len(res) < Len(html) Then
        WrapLinks = html
        Exit Function
    End If

    WrapLinks = res
End Function

' ================================================================
' FIRE HTTP - async fire-and-forget (WinInet, SHB proxy compatible)
' m_Bag keeps object references alive until overwritten.
' ================================================================
Private Sub FireHttp(url As String)
    On Error Resume Next
    Dim h As Object
    Set h = CreateObject("MSXML2.XMLHTTP.6.0")
    If Not h Is Nothing Then
        h.Open "GET", url, True   ' True = async
        h.send
        Set m_Bag(m_BagN Mod 400) = h
        m_BagN = m_BagN + 1
    End If
    On Error GoTo 0
End Sub


' ================================================================
' FIRE HTTP SYNC - blocking, used for pos=sent in Fast Mode
' ================================================================
Private Sub FireHttpSync(url As String)
    On Error Resume Next
    Dim h As Object
    Set h = CreateObject("MSXML2.XMLHTTP.6.0")
    If Not h Is Nothing Then
        h.Open "GET", url, False  ' False = sync
        h.send
    End If
    On Error GoTo 0
End Sub


' ================================================================
' URL ENCODE - UTF-8 via ADODB.Stream
' ================================================================
Private Function UrlEnc(s As String) As String
    If Len(s) = 0 Then UrlEnc = "": Exit Function
    On Error GoTo FallbackEnc

    Dim stm As Object: Set stm = CreateObject("ADODB.Stream")
    stm.Open
    stm.Type = 2: stm.Charset = "UTF-8"
    stm.WriteText s
    stm.Position = 0
    stm.Type = 1
    Dim rawB() As Byte: rawB = stm.Read
    stm.Close: Set stm = Nothing

    ' Detect and skip UTF-8 BOM (EF BB BF = 239 187 191) if present
    Dim bStart As Long: bStart = 0
    If UBound(rawB) >= 2 Then
        If rawB(0) = 239 And rawB(1) = 187 And rawB(2) = 191 Then bStart = 3
    End If

    Dim r As String: r = ""
    Dim bi As Long
    For bi = bStart To UBound(rawB)
        Dim b As Long: b = rawB(bi)
        If (b >= 65 And b <= 90) Or (b >= 97 And b <= 122) Or (b >= 48 And b <= 57) Then
            r = r & Chr(b)
        ElseIf b = 45 Or b = 95 Or b = 46 Or b = 126 Then
            r = r & Chr(b)
        Else
            r = r & "%" & UCase(Right("0" & Hex(b), 2))
        End If
    Next bi
    UrlEnc = r
    Exit Function

FallbackEnc:
    ' ADODB unavailable - ASCII-safe fallback
    ' 2-char hex for all chars: @ (64=0x40) -> %40, NOT %0040
    On Error GoTo 0
    Dim r2 As String: r2 = ""
    Dim fi As Long
    For fi = 1 To Len(s)
        Dim cw As Long: cw = AscW(mid(s, fi, 1))
        If (cw >= 65 And cw <= 90) Or (cw >= 97 And cw <= 122) Or (cw >= 48 And cw <= 57) Then
            r2 = r2 & Chr(cw)
        ElseIf cw = 45 Or cw = 95 Or cw = 46 Or cw = 126 Then
            r2 = r2 & Chr(cw)
        ElseIf cw <= 127 Then
            ' ASCII: 2-char hex - e.g. @ (64=0x40) -> %40
            r2 = r2 & "%" & UCase(Right("0" & Hex(cw), 2))
        Else
            ' Non-ASCII: encode low byte (best effort without UTF-8 stream)
            r2 = r2 & "%" & UCase(Right("0" & Hex(cw And 255), 2))
        End If
    Next fi
    UrlEnc = r2
End Function


' ================================================================
' MAKE SLUG - ASCII only
' ================================================================
' Bo dau tieng Viet + chuyen thuong - dung TRUOC khi loc ASCII trong
' MakeSlug(), de vd "Thong bao" -> "thong-bao" thay vi bi mat het chu
' thanh "thng-bo" (truoc day MakeSlug loai bo HOAN TOAN ky tu co dau
' thay vi chuyen ve khong dau, khien slug hien tren Dashboard bi cut mat
' chu dau du Subject email van hien dung binh thuong - Subject khong di
' qua ham nay).
Private Function StripVNDiacritics(ByVal s As String) As String
    Dim r As String
    r = LCase(s)
    r = Replace(Replace(Replace(Replace(Replace(r, "à", "a"), "á", "a"), "ạ", "a"), "ả", "a"), "ã", "a")
    r = Replace(Replace(Replace(Replace(Replace(r, "â", "a"), "ầ", "a"), "ấ", "a"), "ậ", "a"), "ẩ", "a")
    r = Replace(r, "ẫ", "a")
    r = Replace(Replace(Replace(Replace(Replace(r, "ă", "a"), "ằ", "a"), "ắ", "a"), "ặ", "a"), "ẳ", "a")
    r = Replace(r, "ẵ", "a")
    r = Replace(Replace(Replace(Replace(Replace(r, "è", "e"), "é", "e"), "ẹ", "e"), "ẻ", "e"), "ẽ", "e")
    r = Replace(Replace(Replace(Replace(Replace(r, "ê", "e"), "ề", "e"), "ế", "e"), "ệ", "e"), "ể", "e")
    r = Replace(r, "ễ", "e")
    r = Replace(Replace(Replace(Replace(Replace(r, "ì", "i"), "í", "i"), "ị", "i"), "ỉ", "i"), "ĩ", "i")
    r = Replace(Replace(Replace(Replace(Replace(r, "ò", "o"), "ó", "o"), "ọ", "o"), "ỏ", "o"), "õ", "o")
    r = Replace(Replace(Replace(Replace(Replace(r, "ô", "o"), "ồ", "o"), "ố", "o"), "ộ", "o"), "ổ", "o")
    r = Replace(r, "ỗ", "o")
    r = Replace(Replace(Replace(Replace(Replace(r, "ơ", "o"), "ờ", "o"), "ớ", "o"), "ợ", "o"), "ở", "o")
    r = Replace(r, "ỡ", "o")
    r = Replace(Replace(Replace(Replace(Replace(r, "ù", "u"), "ú", "u"), "ụ", "u"), "ủ", "u"), "ũ", "u")
    r = Replace(Replace(Replace(Replace(Replace(r, "ư", "u"), "ừ", "u"), "ứ", "u"), "ự", "u"), "ử", "u")
    r = Replace(r, "ữ", "u")
    r = Replace(Replace(Replace(Replace(Replace(r, "ỳ", "y"), "ý", "y"), "ỵ", "y"), "ỷ", "y"), "ỹ", "y")
    r = Replace(r, "đ", "d")
    StripVNDiacritics = r
End Function

Private Function MakeSlug(s As String) As String
    Dim base As String: base = StripVNDiacritics(s)
    Dim res As String: res = ""
    Dim ph As Boolean: ph = False
    Dim i As Long
    For i = 1 To Len(base)
        Dim cw As Long: cw = AscW(mid(base, i, 1))
        If (cw >= 97 And cw <= 122) Or (cw >= 48 And cw <= 57) Then
            res = res & Chr(cw): ph = False
        ElseIf cw = 32 Or cw = 45 Or cw = 95 Then
            If Not ph And Len(res) > 0 Then res = res & "-": ph = True
        End If
    Next i
    Do While Len(res) > 0 And Right(res, 1) = "-": res = Left(res, Len(res) - 1): Loop
    If Len(res) = 0 Then res = "campaign"
    MakeSlug = res
End Function


' ================================================================
' PUBLIC: RecallCampaign
' Tu dong recall (xoa ban chua doc) toan bo mail cua 1 campaign (theo
' slug) da gui qua Full mode, thay vi phai mo tay tung mail trong
' 3000 mail.
'
' Gioi han (do Exchange, khong phai do macro):
'   - Chi recall duoc mail gui noi bo cung to chuc Exchange.
'   - Nguoi nhan phai dang dung Outlook Desktop (khong phai Web/Mobile).
'   - Mail phai CHUA duoc mo doc.
' Quet 1 folder Sent Items va thu recall cac mail khop - tach rieng thanh
' Sub de dung chung cho ca vong lap da-account va phan du phong (fallback)
' trong RecallCampaign() ben duoi.
Private Sub ScanFolderForRecall(fld As folder, slug As String, hasCampInfo As Boolean, _
                                  knownSubject As String, tCampStart As Date, tCampEnd As Date, _
                                  tBuf As Date, placeholderHTML As String, _
                                  ByRef matched As Long, ByRef recalled As Long, ByRef failed As Long, _
                                  ByRef failDiag As String, ByRef shrunkR As Long, _
                                  ByRef sampled As Long, ByRef sampleDiag As String)
    Dim i As Long
    Dim itm As Object
    For i = fld.Items.Count To 1 Step -1
        Set itm = fld.Items(i)
        If TypeName(itm) = "MailItem" Then
            Dim itmSlug As String: itmSlug = ""
            On Error Resume Next
            itmSlug = itm.UserProperties("CMSlug").Value
            On Error GoTo 0

            Dim isMatch As Boolean: isMatch = False
            If itmSlug = slug Then
                isMatch = True
            ElseIf hasCampInfo Then
                On Error Resume Next
                If itm.subject = knownSubject And _
                   itm.SentOn >= tCampStart - tBuf And _
                   itm.SentOn <= tCampEnd + tBuf Then
                    isMatch = True
                End If
                On Error GoTo 0
            End If

            ' Chan doan: ghi lai Subject/SentOn thuc te cua 3 mail gan nhat
            ' (bat ke co khop hay khong) de so sanh voi gia tri da luu.
            If sampled < 3 Then
                sampled = sampled + 1
                On Error Resume Next
                sampleDiag = sampleDiag & vbCrLf & "  - subj='" & itm.subject & _
                             "' sentOn=" & Format(itm.SentOn, "yyyy-mm-dd hh:nn:ss")
                On Error GoTo 0
            End If

            If isMatch Then
                matched = matched + 1
                Dim itmErr As String: itmErr = ""
                If RecallOneItem(itm, itmErr) Then
                    recalled = recalled + 1
                Else
                    failed = failed + 1
                    If Len(failDiag) < 1000 Then
                        failDiag = failDiag & vbCrLf & "  - " & itm.subject & ": " & itmErr
                    End If
                End If

                ' Nhan tien rut gon ban luu Sent Items cua mail nay - luc nay
                ' item da "on dinh" du lau trong Sent Items (thoi gian tu luc
                ' gui toi luc RecallCampaign() duoc goi thuong du de Exchange
                ' "chot" xong item, khac voi luc rut gon ngay sau gui bi tre).
                On Error Resume Next
                itm.HTMLBody = placeholderHTML
                itm.Save
                If Err.Number = 0 Then shrunkR = shrunkR + 1
                On Error GoTo 0

                DoEvents

                ' Day Outbox NGAY TRONG LUC vong lap con dang chay - moi lenh
                ' Recall thuc chat la 1 mail "yeu cau thu hoi" xep vao Outbox,
                ' phai duoc Exchange gui di that su moi co hieu luc. Truoc day
                ' toan bo request nay bi don lai, chi gui hang loat SAU KHI ca
                ' vong lap tu dong bam Recall (SendKeys/ExecuteMso) chay xong -
                ' 2 giai doan chay TUAN TU nen tong thoi gian ~gap doi so voi
                ' luc gui ban dau. Goi SendAndReceive dinh ky (moi 20 mail) de
                ' Outlook bat dau truyen Outbox NGAY, chay song song voi phan
                ' con lai cua vong lap thay vi doi don het moi gui.
                If recalled Mod 20 = 0 Then
                    On Error Resume Next
                    Application.GetNamespace("MAPI").SendAndReceive False
                    On Error GoTo 0
                    DoEvents
                End If
            End If
        End If
    Next i
End Sub

Public Sub RecallCampaign()

    Dim slugRaw As String
    slugRaw = InputBox("Nhap ten/slug campaign can Recall (xem trong MsgBox xac nhan luc gui - " & _
                       "co the nhap y nguyen ten chien dich hoac slug, vd: dao-tao-q3-2026):", _
                       "SHB Tracker - Recall")
    If Len(Trim(slugRaw)) = 0 Then Exit Sub
    Dim slug As String: slug = MakeSlug(Trim(slugRaw))

    If MsgBox("Recall (xoa ban chua doc) toan bo mail cua campaign '" & slug & "'?" & vbCrLf & vbCrLf & _
              "Luu y: chi xoa duoc ban CHUA DOC o nguoi nhan noi bo dung Outlook Desktop.", _
              vbYesNo + vbQuestion, "SHB Tracker - Recall") = vbNo Then Exit Sub

    ' De khong bi ngap Inbox voi hang nghin thong bao "Message Recall
    ' Success/Failure" (campaign lon), tu dong bat watcher (RecallNotifWatcher.cls)
    ' - moi thong bao ve toi Inbox se bi xoa NGAY, chay song song voi batch nay.
    ' LUON LUON tao lai TOAN BO watcher moi lan chay (khong dung "If Is
    ' Nothing" nua) - tranh truong hop bien dang giu tham chieu CU khong
    ' duoc lam moi, khien watcher chay ngam la code CU khong nhu mong doi.
    '
    ' Tao 1 watcher RIENG cho MOI account trong profile (khong chi rieng
    ' account mac dinh) - vi thong bao Recall Success/Failure bay ve
    ' Inbox cua DUNG account vua duoc dung de recall, co the KHONG PHAI
    ' account mac dinh (nguoi dung bao gap dung truong hop nay: recall
    ' tren account khac van bi lot thong bao ve vi watcher cu chi theo
    ' doi Inbox cua 1 account mac dinh duy nhat).
    On Error Resume Next
    Set m_RecallWatchers = Nothing
    Set m_RecallWatchers = New Collection

    Dim wAcc As Object, wStore As Object, wStoreID As String
    Dim wSeenStoreIDs As String: wSeenStoreIDs = "|"
    For Each wAcc In Application.Session.Accounts
        Set wStore = Nothing
        Set wStore = wAcc.DeliveryStore
        If Not wStore Is Nothing Then
            wStoreID = ""
            wStoreID = wStore.StoreID
            If Len(wStoreID) > 0 And InStr(wSeenStoreIDs, "|" & wStoreID & "|") = 0 Then
                wSeenStoreIDs = wSeenStoreIDs & wStoreID & "|"

                Dim wInbox As Object, wDeleted As Object
                Set wInbox = wStore.GetDefaultFolder(olFolderInbox)
                Set wDeleted = wStore.GetDefaultFolder(olFolderDeletedItems)
                If Not wInbox Is Nothing And Not wDeleted Is Nothing Then
                    Dim wWatcher As RecallNotifWatcher
                    Set wWatcher = New RecallNotifWatcher
                    Set wWatcher.InboxItems = wInbox.Items
                    ' Theo doi luon Deleted Items - xoa lan 2 ngay tai do de
                    ' xoa VINH VIEN (khong chi chuyen vao roi nam lai chiem
                    ' dung luong).
                    Set wWatcher.DeletedItemsItems = wDeleted.Items
                    m_RecallWatchers.Add wWatcher
                End If
            End If
        End If
    Next wAcc

    ' Du phong: neu vi ly do nao do khong tao duoc watcher cho account nao
    ' (vd loi acc.DeliveryStore nhu da gap voi Shrink/Recall truoc day),
    ' it nhat van bat 1 watcher cho account mac dinh nhu cu.
    If m_RecallWatchers.Count = 0 Then
        Dim wDefWatcher As New RecallNotifWatcher
        Set wDefWatcher.InboxItems = Application.Session.GetDefaultFolder(olFolderInbox).Items
        Set wDefWatcher.DeletedItemsItems = Application.Session.GetDefaultFolder(olFolderDeletedItems).Items
        m_RecallWatchers.Add wDefWatcher
    End If
    On Error GoTo 0

    Dim matched As Long: matched = 0
    Dim recalled As Long: recalled = 0
    Dim failed As Long: failed = 0
    Dim shrunkR As Long: shrunkR = 0
    Dim failDiag As String: failDiag = ""

    Dim placeholder As String
    placeholder = "[Noi dung da duoc rut gon de tiet kiem dung luong hop thu - " & _
                  "email goc da gui thanh cong toi nguoi nhan. Campaign: " & slug & "]"
    Dim placeholderHTML As String
    placeholderHTML = "<html><body style=""font-family:Segoe UI,Arial,sans-serif;" & _
                       "color:#666;font-size:13px;"">" & placeholder & "</body></html>"

    ' Tim theo Subject + khoang thoi gian gui (SaveCampaignInfo luc SendCampaign)
    ' truoc - day la thuoc tinh GOC cua mail, doc duoc NGAY, khong can doi
    ' UserProperty CMSlug on dinh (co the mat vai phut). Neu tim duoc thong
    ' tin da luu, RecallCampaign() chay duoc NGAY LAP TUC sau khi gui xong -
    ' quan trong cho truong hop can recall GAP hang loat.
    Dim knownSubject As String, tCampStart As Date, tCampEnd As Date
    Dim hasCampInfo As Boolean
    hasCampInfo = LoadCampaignInfo(slug, knownSubject, tCampStart, tCampEnd)
    ' Bien do dung sai vai giay cho SentOn (dong ho local vs server co the
    ' lech chut it) - khong lam han hep dieu kien qua muc.
    Dim tBuf As Date: tBuf = TimeSerial(0, 1, 0)

    Dim sampleDiag As String: sampleDiag = ""
    Dim sampled As Long: sampled = 0

    ' Quet Sent Items cua TAT CA account trong profile - xem ghi chu tuong
    ' tu tai ShrinkCampaignSentItems() o tren.
    Dim accountsScanned As Long: accountsScanned = 0
    Dim seenStoreIDs As String: seenStoreIDs = "|"
    Dim acc As Object, store As Object, sentFolder As folder, storeID As String
    For Each acc In Application.Session.Accounts
        On Error Resume Next
        Set store = Nothing
        Set store = acc.DeliveryStore
        On Error GoTo 0
        If store Is Nothing Then GoTo NextAccount

        storeID = ""
        On Error Resume Next
        storeID = store.StoreID
        On Error GoTo 0
        If Len(storeID) = 0 Or InStr(seenStoreIDs, "|" & storeID & "|") > 0 Then GoTo NextAccount
        seenStoreIDs = seenStoreIDs & storeID & "|"

        Set sentFolder = Nothing
        On Error Resume Next
        Set sentFolder = store.GetDefaultFolder(olFolderSentMail)
        On Error GoTo 0
        If sentFolder Is Nothing Then GoTo NextAccount

        accountsScanned = accountsScanned + 1
        ScanFolderForRecall sentFolder, slug, hasCampInfo, knownSubject, tCampStart, tCampEnd, _
                             tBuf, placeholderHTML, matched, recalled, failed, failDiag, _
                             shrunkR, sampled, sampleDiag
NextAccount:
    Next acc

    ' Du phong: giong ShrinkCampaignSentItems(), neu khong quet duoc
    ' account nao qua vong lap tren thi quay lai dung cach cu (v4.68).
    If accountsScanned = 0 Then
        Set sentFolder = Nothing
        On Error Resume Next
        Set sentFolder = Application.Session.GetDefaultFolder(olFolderSentMail)
        On Error GoTo 0
        If Not sentFolder Is Nothing Then
            ScanFolderForRecall sentFolder, slug, hasCampInfo, knownSubject, tCampStart, tCampEnd, _
                                 tBuf, placeholderHTML, matched, recalled, failed, failDiag, _
                                 shrunkR, sampled, sampleDiag
        End If
    End If

    If matched = 0 Then
        Dim noMatchMsg As String
        noMatchMsg = "Khong tim thay mail nao cua campaign '" & slug & "' trong Sent Items." & vbCrLf & _
                     "(Chi cac campaign gui SAU khi cap nhat macro v" & VER & " moi duoc luu lai de recall.)"
        If Not hasCampInfo Then
            noMatchMsg = noMatchMsg & vbCrLf & vbCrLf & _
                "Khong tim thay thong tin campaign da luu (co the do slug/ten nhap sai, " & _
                "hoac campaign nay gui truoc khi cap nhat macro co tinh nang tim nhanh). " & _
                "Kiem tra lai dung ten/slug da dung luc gui."
        Else
            noMatchMsg = noMatchMsg & vbCrLf & vbCrLf & _
                "Thong tin da luu: Subject='" & knownSubject & "', tu " & _
                Format(tCampStart, "yyyy-mm-dd hh:nn:ss") & " den " & Format(tCampEnd, "yyyy-mm-dd hh:nn:ss") & _
                vbCrLf & "3 mail gan nhat trong Sent Items:" & sampleDiag
        End If
        MsgBox noMatchMsg, vbExclamation, "SHB Tracker - Recall"
        Exit Sub
    End If

    ' Day not Outbox lan cuoi cho phan request Recall con lai (neu duoi
    ' 20 mail chua kip trigger o tren, hoac 20 mail cuoi cung cua batch).
    On Error Resume Next
    Application.GetNamespace("MAPI").SendAndReceive False
    On Error GoTo 0

    Dim doneMsg As String
    doneMsg = "Hoan thanh Recall cho campaign '" & slug & "'!" & vbCrLf & _
              "Tim thay  : " & matched & vbCrLf & _
              "Da recall : " & recalled & vbCrLf & _
              "Loi       : " & failed & vbCrLf & _
              "Da rut gon Sent Items: " & shrunkR & vbCrLf & vbCrLf & _
              "Luu y: Recall chi thanh cong voi nguoi nhan noi bo, dung Outlook Desktop, " & _
              "va chua doc mail - day la gioi han cua Exchange."
    If failed > 0 Then doneMsg = doneMsg & vbCrLf & vbCrLf & "Chi tiet loi:" & failDiag
    MsgBox doneMsg, vbInformation, "SHB Tracker - Recall"
End Sub


' ================================================================
' RECALL ONE ITEM
' "Recall This Message" la lenh Ribbon (Fluent UI), KHONG nam trong
' MailItem.Actions (chi co Reply/ReplyAll/Forward...). Phai mo mail
' (Display) roi goi lenh qua Inspector.CommandBars.ExecuteMso, sau do
' tu dong xac nhan dialog "Message Recall" bang SendKeys (Outlook
' Object Model khong co API recall khong-dialog). Dialog mac dinh da
' chon san radio "Delete unread copies of this message" nen chi can
' Enter de xac nhan.
'
' QUAN TRONG: ExecuteMso mo dialog o dang MODAL, block luon dong lenh
' - phai SendKeys TRUOC (Wait:=False, dua phim vao hang doi input cua
' Windows) roi moi goi ExecuteMso; dialog vua mo len se tu "an" phim
' da xep hang san. Neu SendKeys o SAU ExecuteMso se bi treo vi
' ExecuteMso khong bao gio return de chay toi dong SendKeys do.
' ================================================================
Private Function RecallOneItem(itm As Object, _
                                Optional ByRef errMsg As String = "") As Boolean
    On Error GoTo Fail

    itm.Display

    ' Doi TOI DA 1.5s nhu cac ban truoc (van giu nguyen tran an toan cho
    ' may cham), nhung THOAT SOM ngay khi Inspector da san sang thay vi
    ' luon cho du 1.5s co dinh - da so may binh thuong san sang chi sau
    ' vai chuc ms, giam dang ke thoi gian trung binh moi mail ma KHONG
    ' giam tran an toan cho truong hop may cham (khong lam giam do tin
    ' cay da duoc debug rat ky truoc day - chi bo phan CHO THUA khong
    ' can thiet, khong dong vao phan ExecuteMso/SendKeys nhay cam hon).
    Dim tOpenMax As Date: tOpenMax = Now + TimeSerial(0, 0, 0) + (1.5 / 86400)
    Dim readInsp As Object
    Do
        Set readInsp = Nothing
        On Error Resume Next
        Set readInsp = Application.ActiveInspector
        On Error GoTo Fail
        If Not readInsp Is Nothing Then Exit Do
        DoEvents
    Loop While Now < tOpenMax

    If readInsp Is Nothing Then
        errMsg = "Khong mo duoc cua so mail can recall."
        GoTo FailNoErrObj
    End If

    On Error Resume Next
    readInsp.Activate
    On Error GoTo Fail

    ' Cung nguyen tac: san nhu cu la 1s, nhung thoat som ngay khi
    ' CommandBars cua Inspector truy cap duoc (dau hieu cua so da thuc
    ' su san sang nhan lenh ExecuteMso ben duoi) - giu san toi thieu
    ' 0.15s de tranh truong hop kiem tra qua som luc animation cua so
    ' chua kip on dinh.
    Dim tFocusMin As Date: tFocusMin = Now + TimeSerial(0, 0, 0) + (0.15 / 86400)
    Do While Now < tFocusMin: DoEvents: Loop

    Dim tFocusMax As Date: tFocusMax = Now + TimeSerial(0, 0, 1)
    Do
        Dim cbOK As Boolean: cbOK = False
        On Error Resume Next
        Err.Clear
        Dim cbTest As Object: Set cbTest = readInsp.CommandBars
        cbOK = (Err.Number = 0 And Not cbTest Is Nothing)
        On Error GoTo Fail
        If cbOK Then Exit Do
        DoEvents
    Loop While Now < tFocusMax

    Dim gotResult As Boolean: gotResult = False
    Dim attempt As Long
    For attempt = 1 To 3
        SendKeys "~", False   ' Enter = OK (mac dinh dang chon "Delete unread copies")

        On Error Resume Next
        readInsp.CommandBars.ExecuteMso "RecallThisMessage"
        Dim ExecErr As Long: ExecErr = Err.Number
        Dim ExecDesc As String: ExecDesc = Err.Description
        On Error GoTo Fail

        Dim tW As Date: tW = Now + TimeSerial(0, 0, 0) + (0.4 / 86400)
        Do While Now < tW: DoEvents: Loop

        If ExecErr = 0 Then
            gotResult = True
            Exit For
        End If

        Dim tRetryWait As Date: tRetryWait = Now + TimeSerial(0, 0, 1)
        Do While Now < tRetryWait: DoEvents: Loop
    Next attempt

    If Not gotResult Then
        errMsg = "ExecuteMso 'RecallThisMessage' loi #" & ExecErr & " " & ExecDesc & _
                 " (mail co the khong phai gui qua Exchange, hoac nguoi gui khong con quyen recall)."
        On Error Resume Next
        readInsp.Close olDiscard
        On Error GoTo Fail
        GoTo FailNoErrObj
    End If

    On Error Resume Next
    readInsp.Close olDiscard
    On Error GoTo 0

    RecallOneItem = True
    Exit Function

Fail:
    errMsg = "#" & Err.Number & " " & Err.Description
    On Error Resume Next
    If Not readInsp Is Nothing Then readInsp.Close olDiscard
    On Error GoTo 0
FailNoErrObj:
    RecallOneItem = False
End Function


' ================================================================
' Ghi chu: Start/StopRecallNotificationWatcher va CleanCampaignCopies da
' bi bo han - theo yeu cau chi giu 2 macro chinh SendCampaign/RecallCampaign
' trong Alt+F8. Logic bat watcher da duoc gop truc tiep vao dau
' RecallCampaign() o tren.
'
' CleanRecallNotifications duoc GIU LAI ben duoi (Private, an khoi Alt+F8)
' lam phuong an du phong - watcher thuong tu xoa NGAY cac mail "Message
' Recall Success/Failure" khi ve Inbox, nhung neu vi ly do nao do (Outlook
' restart giua chung, watcher loi...) ma thong bao con sot lai, can mo
' tam thanh Public (doi "Private Sub" -> "Public Sub" ngay duoi day) roi
' Alt+F8 chay 1 lan de don sach, sau do doi lai Private neu muon.
' ================================================================
Private Sub CleanRecallNotifications()
    Dim ib As folder
    Set ib = Application.Session.GetDefaultFolder(olFolderInbox)

    Dim n As Long: n = 0
    Dim i As Long
    For i = ib.Items.Count To 1 Step -1
        Dim itm As Object: Set itm = ib.Items(i)
        Dim subj As String: subj = ""
        On Error Resume Next
        subj = itm.subject
        On Error GoTo 0
        If Left(subj, 22) = "Message Recall Success" Or _
           Left(subj, 22) = "Message Recall Failure" Then
            itm.Delete
            n = n + 1
        End If
    Next i

    MsgBox "Da xoa " & n & " mail thong bao Recall Success/Failure trong Inbox.", _
           vbInformation, "SHB Tracker v" & VER
End Sub
