Option Explicit

' ================================================================
' CONG CU CHAN DOAN TAM THOI - KHONG PHAI PHAN CUA MACRO CHINH THUC.
' Xuat HTMLBody cua draft dang mo ra file text, de gui cho Claude soi
' chinh xac cau truc HTML/VML thuc te dang gay loi WrapLinks().
'
' CACH DUNG:
'   1. Mo draft mail dang gap loi (co anh gan hyperlink) trong Outlook.
'   2. Import file nay (File > Import File...) vao VBA Project.
'   3. Alt+F8 > chay ExportDraftHTML.
'   4. Mo file C:\SHBTrackerLogs\draft-html-dump.txt bang Notepad, copy
'      toan bo noi dung, gui lai cho Claude.
'   5. Sau khi xong, co the xoa module nay di (chuot phai > Remove).
' ================================================================
Public Sub ExportDraftHTML()
    Dim insp As Object
    Set insp = Application.ActiveInspector
    If insp Is Nothing Then
        MsgBox "Mo cua so email dang soan truoc khi chay.", vbExclamation
        Exit Sub
    End If

    Dim itm As Object
    Set itm = insp.CurrentItem
    If itm Is Nothing Or itm.Class <> olMail Then
        MsgBox "Khong tim thay email dang soan.", vbExclamation
        Exit Sub
    End If

    Dim dirPath As String: dirPath = "C:\SHBTrackerLogs"
    If Len(Dir(dirPath, vbDirectory)) = 0 Then MkDir dirPath

    Dim outPath As String: outPath = dirPath & "\draft-html-dump.txt"
    Dim f As Integer: f = FreeFile
    Open outPath For Output As #f
    Print #f, itm.HTMLBody
    Close #f

    MsgBox "Da xuat HTML ra file:" & vbCrLf & outPath & vbCrLf & vbCrLf & _
           "Mo file nay bang Notepad, copy toan bo noi dung gui lai.", vbInformation
End Sub
