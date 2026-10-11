# Test tạo Estate bằng Postman

## 1. Chuẩn bị

Chạy API và đặt biến môi trường Postman:

```text
baseUrl = http://localhost:3000/api/v1
accessToken = <customer access token>
providerId = <provider account id, nếu có nhiều provider>
provinceId = <province id>
wardId = <ward id>
```

Tài khoản dùng để tạo Estate phải có Provider context hợp lệ: membership
`ACTIVE`, ProviderAccount `ACTIVE`, verification `VERIFIED`, và permission
`property:create`.

## 2. Lấy location IDs

Gửi:

```http
GET {{baseUrl}}/locations/provinces
```

Lấy `id` của một province, sau đó gửi:

```http
GET {{baseUrl}}/locations/provinces/{{provinceId}}/wards
```

Lưu `id` của một ward thuộc đúng province vào biến `wardId`.

## 3. Đăng nhập

```http
POST {{baseUrl}}/customers/auth/login
Content-Type: application/json
```

```json
{
  "email": "provider@example.com",
  "password": "your-password"
}
```

Lưu `data.accessToken` vào biến `accessToken`. Nếu tài khoản có nhiều
Provider membership, lấy `data.id` từ:

```http
GET {{baseUrl}}/providers/me
Authorization: Bearer {{accessToken}}
```

và gửi thêm header `X-Provider-Id: {{providerId}}` ở request tạo Estate.

## 4. Tạo Estate

```http
POST {{baseUrl}}/estates
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

Body chọn `raw` → `JSON`:

```json
{
  "title": "Căn hộ Riverside",
  "description": "Căn hộ view sông, đầy đủ nội thất",
  "type": "APARTMENT",
  "purpose": "SALE",
  "price": 3500000000,
  "area": 82.5,
  "bedrooms": 2,
  "bathrooms": 2,
  "floors": 20,
  "addressLine": "1 Nguyễn Huệ",
  "provinceId": "{{provinceId}}",
  "wardId": "{{wardId}}",
  "latitude": 10.7769,
  "longitude": 106.7009
}
```

Kết quả thành công là HTTP `201`; Estate mới có `data.status = "DRAFT"` và
response đã gồm `province` và `ward`.

## 5. Kiểm tra Estate vừa tạo

Danh sách theo Provider:

```http
GET {{baseUrl}}/estates/mine
Authorization: Bearer {{accessToken}}
```

Hoặc lấy public detail sau khi Estate đã được activate:

```http
GET {{baseUrl}}/estates/{{estateId}}
```

Estate mới tạo là `DRAFT`, nên cần activate trước khi xuất hiện trên public
Marketplace:

```http
POST {{baseUrl}}/estates/{{estateId}}/activate
Authorization: Bearer {{accessToken}}
```

Không gửi `customerId`, `providerId`, `status`, `id`, `createdAt` hoặc
`updatedAt` trong body tạo Estate; ownership và status đều do server quyết
định.

## 6. Upload hình ảnh cho Estate

Sau khi tạo Estate, lấy `estateId` từ `data.id`, rồi tạo request:

```http
POST {{baseUrl}}/estates/{{estateId}}/media
Authorization: Bearer {{accessToken}}
X-Provider-Id: {{providerId}}
```

Trong Postman chọn `Body` → `form-data`, thêm đúng một field:

| Key | Type | Value |
| --- | --- | --- |
| `file` | File | Chọn ảnh `.jpg`, `.jpeg` hoặc `.png` |

Không dùng `raw`, không dùng `application/json`, và tên field phải chính xác
là `file`. Ảnh tối đa 5 MB. `X-Provider-Id` chỉ bắt buộc khi tài khoản có
nhiều Provider context.

Response thành công là HTTP `201`:

```json
{
  "status": true,
  "data": {
    "id": "<media-id>",
    "estateId": "<estate-id>",
    "mediaUrl": "estates/<estate-id>/<generated-id>.jpg",
    "type": "image",
    "sortOrder": 0
  }
}
```

`mediaUrl` hiện là object key trong S3/SeaweedFS, chưa phải URL public để
trình duyệt mở trực tiếp. Local upload cần SeaweedFS chạy ở `localhost:8333`
và các biến `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` trong
`.env`.
